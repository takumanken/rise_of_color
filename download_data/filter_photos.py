#!/usr/bin/env python3
"""
Minimal CLIP-based Photo Filter - Separates photos from non-photos
"""
import os, sys, shutil, time
from pathlib import Path
from tqdm import tqdm
import torch
import PIL.Image as PILImage
import open_clip

#############################################
# CONFIGURATION
#############################################
BASE_DIR = "yearly_photos"     # Base directory with year folders
START_YEAR = 2007              # Start year
END_YEAR = 2025                # End year
BATCH_SIZE = 64                # Images per batch
MODEL_NAME = 'ViT-B-32'        # CLIP model to use
#############################################

# Minimal logging setup
def log(message):
    print(f"{time.strftime('%H:%M:%S')} - {message}")

class PhotoClassifier:
    def __init__(self):
        log(f"Loading CLIP model ({MODEL_NAME})...")
        torch.manual_seed(42)
        
        self.model, _, self.preprocess = open_clip.create_model_and_transforms(
            MODEL_NAME, pretrained='laion2b_s34b_b79k')
        self.tokenizer = open_clip.get_tokenizer(MODEL_NAME)
        
        # Simple photo vs non-photo prompts
        self.prompts = [
            "a genuine photograph taken with a camera",  # Photo prompt
            "an illustration or drawing",                # Non-photo prompts
            "a painting or artwork", 
            "a digital image or render",
            "a document or text",
        ]
        
        # First prompt is photo, rest are non-photo
        self.photo_idx = {0}
        self.non_photo_idx = set(range(1, len(self.prompts)))
        
        # Pre-compute text features
        self.text_tokens = self.tokenizer(self.prompts)
        self.model.eval()
        with torch.no_grad():
            self.text_features = self.model.encode_text(self.text_tokens)
            self.text_features = self.text_features / self.text_features.norm(dim=-1, keepdim=True)
    
    def classify_batch(self, image_paths):
        """Identify photos vs non-photos"""
        if not image_paths:
            return []
            
        # Process images
        images = []
        valid_indices = []
        
        for i, path in enumerate(image_paths):
            try:
                with PILImage.open(path) as img:
                    img_tensor = self.preprocess(img.convert("RGB"))
                    images.append(img_tensor)
                    valid_indices.append(i)
            except Exception:
                pass  # Skip problematic images
        
        if not images:
            return [False] * len(image_paths)
            
        # Run image batch through CLIP
        with torch.no_grad():
            image_batch = torch.stack(images)
            image_features = self.model.encode_image(image_batch)
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            
            # Calculate scores
            similarities = image_features @ self.text_features.T
            photo_scores = similarities[:, list(self.photo_idx)].max(dim=1).values
            non_photo_scores = similarities[:, list(self.non_photo_idx)].max(dim=1).values
            is_photo = photo_scores > non_photo_scores
        
        # Build results list (default False for invalid images)
        results = [False] * len(image_paths)
        for idx, valid_idx in enumerate(valid_indices):
            results[valid_idx] = is_photo[idx].item()
        
        return results

def process_directory(classifier, dir_path):
    """Process all images in a directory"""
    dir_path = Path(dir_path)
    log(f"Processing: {dir_path.name}")
    
    # Create non_photo directory
    non_photo_dir = dir_path / "non_photo"
    non_photo_dir.mkdir(exist_ok=True)
    
    # Find all images
    extensions = {'.jpg', '.jpeg', '.png', '.tiff', '.tif'}
    main_images = []
    non_photo_images = []
    
    # Collect files from main directory
    for ext in extensions:
        main_images.extend([str(p) for p in dir_path.glob(f"*{ext}") if p.parent.name != "non_photo"])
        main_images.extend([str(p) for p in dir_path.glob(f"*{ext.upper()}") if p.parent.name != "non_photo"])
    
    # Collect files from non_photo directory
    for ext in extensions:
        non_photo_images.extend([str(p) for p in non_photo_dir.glob(f"*{ext}")])
        non_photo_images.extend([str(p) for p in non_photo_dir.glob(f"*{ext.upper()}")])
    
    log(f"Found {len(main_images)} images in main directory, {len(non_photo_images)} in non_photo")
    
    # Process main directory images
    kept = 0
    moved = 0
    
    if main_images:
        for i in tqdm(range(0, len(main_images), BATCH_SIZE), desc="Main directory"):
            batch = main_images[i:i+BATCH_SIZE]
            results = classifier.classify_batch(batch)
            
            for path, is_photo in zip(batch, results):
                if is_photo:
                    kept += 1
                else:
                    # Move to non_photo directory
                    filename = os.path.basename(path)
                    dest_path = str(non_photo_dir / filename)
                    shutil.move(path, dest_path)
                    moved += 1
    
    # Process non_photo directory images
    rescued = 0
    
    if non_photo_images:
        for i in tqdm(range(0, len(non_photo_images), BATCH_SIZE), desc="Non_photo directory"):
            batch = non_photo_images[i:i+BATCH_SIZE]
            results = classifier.classify_batch(batch)
            
            for path, is_photo in zip(batch, results):
                if is_photo:
                    # Move back to main directory
                    filename = os.path.basename(path)
                    dest_path = str(dir_path / filename)
                    shutil.move(path, dest_path)
                    rescued += 1
    
    log(f"Kept {kept} photos, moved {moved} non-photos, rescued {rescued} photos")
    return kept, moved, rescued

def main():
    if not os.path.exists(BASE_DIR):
        log(f"Error: Base directory does not exist: {BASE_DIR}")
        sys.exit(1)
    
    # Initialize classifier
    classifier = PhotoClassifier()
    
    # Process each year in the range
    start_time = time.time()
    total_kept = total_moved = total_rescued = 0
    years_processed = 0
    
    for year in range(START_YEAR, END_YEAR + 1):
        year_dir = os.path.join(BASE_DIR, str(year))
        if os.path.exists(year_dir):
            kept, moved, rescued = process_directory(classifier, year_dir)
            total_kept += kept
            total_moved += moved
            total_rescued += rescued
            years_processed += 1
    
    # Print summary
    elapsed = time.time() - start_time
    log(f"COMPLETE: Processed {years_processed} years in {elapsed:.1f} seconds")
    log(f"Photos kept: {total_kept}, Non-photos moved: {total_moved}, Photos rescued: {total_rescued}")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("Interrupted by user")
        sys.exit(1)
    except Exception as e:
        log(f"Error: {e}")
        sys.exit(1)