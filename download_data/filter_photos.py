import os
import sys
import shutil
import numpy as np
from glob import glob
from PIL import Image, ImageStat
import math
try:
    from tqdm import tqdm
    has_tqdm = True
except ImportError:
    has_tqdm = False

# Configuration
PHOTOS_DIR = "yearly_photos"  # Base directory with year subfolders
MOVE_NON_PHOTOS = True        # If True, move non-photos to separate folder

def analyze_image(image_path):
    """Analyze an image to determine if it's a photograph using simple heuristics."""
    try:
        # Open the image
        img = Image.open(image_path)
        
        # Basic checks
        width, height = img.size
        
        # 1. Check image dimensions (very small images unlikely to be photos)
        if width < 50 or height < 50:
            return {'is_photo': False, 'reason': 'too small'}
            
        # 2. Convert to RGB if needed
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # 3. Get image statistics
        stat = ImageStat.Stat(img)
        
        # 4. Check aspect ratio (diagrams/illustrations often have extreme ratios)
        aspect_ratio = max(width, height) / min(width, height)
        if aspect_ratio > 3:
            return {'is_photo': False, 'reason': 'extreme aspect ratio'}
        
        # 5. Check color variance (photos typically have more varied colors)
        r_var, g_var, b_var = stat.var
        color_variance = (r_var + g_var + b_var) / 3
        if color_variance < 100:
            return {'is_photo': False, 'reason': 'low color variance'}
        
        # 6. Check color distribution
        r_mean, g_mean, b_mean = stat.mean
        overall_brightness = (r_mean + g_mean + b_mean) / 3
        
        # Very uniform brightness suggests graphics/illustrations
        if min(stat.stddev) < 20:
            return {'is_photo': False, 'reason': 'uniform color distribution'}
            
        # 7. Analyze color count by sampling (full analysis too slow)
        img_small = img.resize((50, 50))  # Downsize for faster processing
        pixels = list(img_small.getdata())
        unique_colors = len(set(pixels))
        
        # Photos typically have many unique colors
        if unique_colors < 500:
            return {'is_photo': False, 'reason': 'limited color palette'}
            
        # 8. Check for extremely uniform areas (suggests graphics)
        img_array = np.array(img_small)
        blocks = [
            img_array[0:25, 0:25], 
            img_array[0:25, 25:50],
            img_array[25:50, 0:25],
            img_array[25:50, 25:50]
        ]
        for block in blocks:
            block_var = np.var(block)
            if block_var < 50:  # Very uniform block
                return {'is_photo': False, 'reason': 'contains uniform areas'}
        
        # If it passed all tests, it's likely a photograph
        return {'is_photo': True, 'reason': 'passed all checks'}
        
    except Exception as e:
        print(f"Error analyzing {image_path}: {e}")
        return {'is_photo': True, 'reason': 'error in analysis'}

def process_year_directory(year_dir):
    """Process all images in a year directory."""
    # Create a directory for non-photos if needed
    non_photos_dir = os.path.join(year_dir, "non_photos")
    if MOVE_NON_PHOTOS and not os.path.exists(non_photos_dir):
        os.makedirs(non_photos_dir, exist_ok=True)
    
    # Get all image files
    image_files = glob(os.path.join(year_dir, "*.jpg")) + \
                  glob(os.path.join(year_dir, "*.jpeg")) + \
                  glob(os.path.join(year_dir, "*.png")) + \
                  glob(os.path.join(year_dir, "*.gif"))
    
    if not image_files:
        print(f"No image files found in {year_dir}")
        return 0, 0
    
    # Process each image
    print(f"Processing {len(image_files)} images in {year_dir}...")
    photo_count = 0
    non_photo_count = 0
    
    # Use tqdm if available, otherwise use simple counter
    if has_tqdm:
        iterator = tqdm(image_files)
    else:
        iterator = image_files
        print(f"0/{len(image_files)} processed", end='\r')
    
    for i, image_path in enumerate(iterator):
        # Update progress if not using tqdm
        if not has_tqdm and (i % 5 == 0 or i+1 == len(image_files)):
            print(f"{i+1}/{len(image_files)} processed", end='\r')
            
        # Skip if already in non_photos directory
        if "/non_photos/" in image_path:
            continue
            
        # Get the filename
        filename = os.path.basename(image_path)
        
        # Analyze the image
        analysis = analyze_image(image_path)
        
        if analysis['is_photo']:
            photo_count += 1
        else:
            non_photo_count += 1
            
            # Move non-photos if requested
            if MOVE_NON_PHOTOS:
                try:
                    shutil.move(image_path, os.path.join(non_photos_dir, filename))
                    reason = analysis.get('reason', 'unknown')
                    print(f"  ↦ Moved non-photo to non_photos/ - Reason: {reason}")
                except Exception as e:
                    print(f"  ⚠️ Failed to move {filename}: {e}")
    
    if not has_tqdm:
        print()  # New line after progress display
    print(f"Year {os.path.basename(year_dir)}: {photo_count} photos, {non_photo_count} non-photos")
    return photo_count, non_photo_count

def main():
    """Main function to process all year directories."""
    if not os.path.exists(PHOTOS_DIR):
        print(f"Error: Directory '{PHOTOS_DIR}' not found.")
        return
    
    # Find all year directories
    year_dirs = [d for d in glob(os.path.join(PHOTOS_DIR, "*")) if os.path.isdir(d)]
    if not year_dirs:
        print(f"No year directories found in {PHOTOS_DIR}")
        return
    
    print(f"Found {len(year_dirs)} year directories to process")
    
    # Process each year directory
    total_photos = 0
    total_non_photos = 0
    
    for year_dir in sorted(year_dirs):
        photos, non_photos = process_year_directory(year_dir)
        total_photos += photos
        total_non_photos += non_photos
    
    # Print summary
    total_images = total_photos + total_non_photos
    if total_images > 0:
        print("\n" + "="*50)
        print("ANALYSIS COMPLETE")
        print("="*50)
        print(f"Total images processed: {total_images}")
        print(f"Images classified as photographs: {total_photos} ({total_photos/total_images*100:.1f}%)")
        print(f"Images classified as non-photographs: {total_non_photos} ({total_non_photos/total_images*100:.1f}%)")
        
        if MOVE_NON_PHOTOS:
            print("\nNon-photographic images have been moved to 'non_photos' subdirectories")
    else:
        print("No images were processed.")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nProcess interrupted by user")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)