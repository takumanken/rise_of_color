#!/usr/bin/env python3
"""CLIP-based Photo Filter - Separates photos from non-photos"""
import os
import sys
import shutil
import time
from pathlib import Path
import torch
import PIL.Image as PILImage
import open_clip

# Configuration
BASE_DIR = "yearly_photos"
START_YEAR = 2025
END_YEAR = 2025
BATCH_SIZE = 64
MODEL_NAME = 'ViT-B-32'

def log(message):
    print(f"{time.strftime('%H:%M:%S')} - {message}")

def setup_model():
    """Set up the CLIP model and text features"""
    log(f"Loading CLIP model ({MODEL_NAME})...")
    torch.manual_seed(42)
    
    model, _, preprocess = open_clip.create_model_and_transforms(
        MODEL_NAME, pretrained='laion2b_s34b_b79k')
    tokenizer = open_clip.get_tokenizer(MODEL_NAME)
    
    prompts = [
        "a genuine photograph taken with a camera",
        "an illustration or drawing",
        "a painting or artwork", 
        "a digital image or render",
        "a document or text",
    ]
    
    text_tokens = tokenizer(prompts)
    model.eval()
    with torch.no_grad():
        text_features = model.encode_text(text_tokens)
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)
    
    return model, preprocess, text_features

def classify_batch(model, preprocess, text_features, image_paths):
    """Classify a batch of images as photos or non-photos"""
        
    images = []
    valid_indices = []
    
    for i, path in enumerate(image_paths):
        try:
            with PILImage.open(path) as img:
                img_tensor = preprocess(img.convert("RGB"))
                images.append(img_tensor)
                valid_indices.append(i)
        except Exception:
            pass
            
    with torch.no_grad():
        image_batch = torch.stack(images)
        image_features = model.encode_image(image_batch)
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        
        similarities = image_features @ text_features.T
        photo_scores = similarities[:, 0]
        non_photo_scores = similarities[:, 1:].max(dim=1).values
        is_photo = photo_scores > non_photo_scores
    
    results = [False] * len(image_paths)
    for idx, valid_idx in enumerate(valid_indices):
        results[valid_idx] = is_photo[idx].item()
    
    return results

def find_images(directory):
    """Find all image files in a directory"""
    extensions = ['.jpg', '.jpeg', '.png', '.tif', '.tiff']
    images = []
    
    for ext in extensions:
        images.extend(str(p) for p in Path(directory).glob(f"*{ext}"))
        images.extend(str(p) for p in Path(directory).glob(f"*{ext.upper()}"))
    
    return images

def process_directory(model, preprocess, text_features, dir_path):
    """Process all images in a directory, separating photos from non-photos"""
    dir_path = Path(dir_path)
    log(f"Processing: {dir_path.name}")
    
    non_photo_dir = dir_path / "non_photo"
    non_photo_dir.mkdir(exist_ok=True)
    
    # Find images in main directory (excluding non_photo subdirectory)
    main_images = [img for img in find_images(dir_path) if Path(img).parent.name != "non_photo"]
    non_photo_images = find_images(non_photo_dir)
    
    log(f"Found {len(main_images)} images in main directory, {len(non_photo_images)} in non_photo")
    
    def process_images(images, move_if_photo, dest_dir):
        """Process images and move them if they match the condition"""
        for i in range(0, len(images), BATCH_SIZE):
            batch = images[i:i+BATCH_SIZE]
            results = classify_batch(model, preprocess, text_features, batch)
            
            for path, is_photo in zip(batch, results):
                if is_photo == move_if_photo:
                    filename = os.path.basename(path)
                    dest_path = str(dest_dir / filename)
                    shutil.move(path, dest_path)
    
    # Move non-photos from main directory
    process_images(main_images, False, non_photo_dir)
    
    # Rescue photos from non-photo directory
    process_images(non_photo_images, True, dir_path)

def main():
    if not os.path.exists(BASE_DIR):
        log(f"Error: Base directory does not exist: {BASE_DIR}")
        sys.exit(1)
    
    model, preprocess, text_features = setup_model()
    
    start_time = time.time()
    years_processed = 0
    
    for year in range(START_YEAR, END_YEAR + 1):
        year_dir = os.path.join(BASE_DIR, str(year))
        if os.path.exists(year_dir):
            process_directory(model, preprocess, text_features, year_dir)
            years_processed += 1
    
    elapsed = time.time() - start_time
    log(f"COMPLETE: Processed {years_processed} years in {elapsed:.1f} seconds")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("Interrupted by user")
        sys.exit(1)
    except Exception as e:
        log(f"Error: {e}")
        sys.exit(1)