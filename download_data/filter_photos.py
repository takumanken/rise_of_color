#!/usr/bin/env python3
"""CLIP-based Photo Filter - Separates photos from non-photos"""
import os
import sys
import shutil
import time
from pathlib import Path
from tqdm import tqdm
import torch
import PIL.Image as PILImage
import open_clip

# Configuration
BASE_DIR = "yearly_photos"
START_YEAR = 2007
END_YEAR = 2025
BATCH_SIZE = 64
MODEL_NAME = 'ViT-B-32'

def log(message):
    print(f"{time.strftime('%H:%M:%S')} - {message}")

class PhotoClassifier:
    def __init__(self):
        log(f"Loading CLIP model ({MODEL_NAME})...")
        torch.manual_seed(42)
        
        self.model, _, self.preprocess = open_clip.create_model_and_transforms(
            MODEL_NAME, pretrained='laion2b_s34b_b79k')
        self.tokenizer = open_clip.get_tokenizer(MODEL_NAME)
        
        self.prompts = [
            "a genuine photograph taken with a camera",  # Photo prompt
            "an illustration or drawing",                # Non-photo prompts
            "a painting or artwork", 
            "a digital image or render",
            "a document or text",
        ]
        
        self.photo_idx = {0}
        self.non_photo_idx = set(range(1, len(self.prompts)))
        
        self.text_tokens = self.tokenizer(self.prompts)
        self.model.eval()
        with torch.no_grad():
            self.text_features = self.model.encode_text(self.text_tokens)
            self.text_features = self.text_features / self.text_features.norm(dim=-1, keepdim=True)
    
    def classify_batch(self, image_paths):
            
        images = []
        valid_indices = []
        
        for i, path in enumerate(image_paths):
            try:
                with PILImage.open(path) as img:
                    img_tensor = self.preprocess(img.convert("RGB"))
                    images.append(img_tensor)
                    valid_indices.append(i)
            except Exception:
                pass
        
        if not images:
            return [False] * len(image_paths)
            
        with torch.no_grad():
            image_batch = torch.stack(images)
            image_features = self.model.encode_image(image_batch)
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            
            similarities = image_features @ self.text_features.T
            photo_scores = similarities[:, list(self.photo_idx)].max(dim=1).values
            non_photo_scores = similarities[:, list(self.non_photo_idx)].max(dim=1).values
            is_photo = photo_scores > non_photo_scores
        
        results = [False] * len(image_paths)
        for idx, valid_idx in enumerate(valid_indices):
            results[valid_idx] = is_photo[idx].item()
        
        return results

def process_directory(classifier, dir_path):
    dir_path = Path(dir_path)
    log(f"Processing: {dir_path.name}")
    
    non_photo_dir = dir_path / "non_photo"
    non_photo_dir.mkdir(exist_ok=True)
    
    extensions = {'.jpg', '.jpeg', '.png', '.tiff', '.tif'}
    main_images = []
    non_photo_images = []
    
    for ext in extensions:
        main_images.extend([str(p) for p in dir_path.glob(f"*{ext}") if p.parent.name != "non_photo"])
        main_images.extend([str(p) for p in dir_path.glob(f"*{ext.upper()}") if p.parent.name != "non_photo"])
    
    for ext in extensions:
        non_photo_images.extend([str(p) for p in non_photo_dir.glob(f"*{ext}")])
        non_photo_images.extend([str(p) for p in non_photo_dir.glob(f"*{ext.upper()}")])
    
    log(f"Found {len(main_images)} images in main directory, {len(non_photo_images)} in non_photo")
    
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
                    filename = os.path.basename(path)
                    dest_path = str(non_photo_dir / filename)
                    shutil.move(path, dest_path)
                    moved += 1
    
    rescued = 0
    
    if non_photo_images:
        for i in tqdm(range(0, len(non_photo_images), BATCH_SIZE), desc="Non_photo directory"):
            batch = non_photo_images[i:i+BATCH_SIZE]
            results = classifier.classify_batch(batch)
            
            for path, is_photo in zip(batch, results):
                if is_photo:
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
    
    classifier = PhotoClassifier()
    
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