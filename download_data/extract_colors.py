import os
import glob
import json
import random
from PIL import Image
import numpy as np
import argparse

def extract_colors_by_year(base_dir="yearly_photos", output_file="colors_by_year.json", 
                           max_pixels=10000, sample_method="resize"):
    """
    Extract colors from all images in yearly_photos directory, organized by year.
    
    Args:
        base_dir: Base directory containing year folders
        output_file: File to save the JSON output
        max_pixels: Maximum number of pixels to extract per image
        sample_method: Method to reduce pixels ('resize' or 'random')
    """
    # Check if base directory exists
    if not os.path.exists(base_dir):
        print(f"Error: Directory '{base_dir}' not found.")
        return
    
    # Find all year directories
    year_dirs = [d for d in glob.glob(os.path.join(base_dir, "*")) if os.path.isdir(d)]
    if not year_dirs:
        print(f"No year directories found in {base_dir}")
        return
    
    print(f"Found {len(year_dirs)} year directories")
    
    # Final data structure - an array of year objects
    all_data = []
    
    # Process each year directory
    for year_dir in sorted(year_dirs):
        year = os.path.basename(year_dir)
        
        try:
            year_int = int(year)
        except ValueError:
            print(f"Skipping non-year directory: {year}")
            continue
            
        print(f"Processing year: {year}")
        
        # Get image files in this year (excluding subdirectories like non_photos, edit, etc.)
        image_files = []
        for ext in ['jpg', 'jpeg', 'png', 'gif']:
            image_files.extend(glob.glob(os.path.join(year_dir, f"*.{ext}")))
            image_files.extend(glob.glob(os.path.join(year_dir, f"*.{ext.upper()}")))
        
        if not image_files:
            print(f"  No images found in {year_dir}")
            continue
        
        print(f"  Found {len(image_files)} images")
        
        # Process each image
        for img_path in image_files:
            img_name = os.path.basename(img_path)
            print(f"    Processing {img_name}")
            
            try:
                # Open image and convert to RGB
                with Image.open(img_path) as img:
                    if img.mode != 'RGB':
                        img = img.convert('RGB')
                    
                    # Get pixel data based on sampling method
                    original_size = img.width * img.height
                    
                    if sample_method == "resize" and original_size > max_pixels:
                        # Resize image to have approximately max_pixels
                        scale_factor = np.sqrt(max_pixels / original_size)
                        new_width = max(1, int(img.width * scale_factor))
                        new_height = max(1, int(img.height * scale_factor))
                        img = img.resize((new_width, new_height), Image.LANCZOS)
                        img_array = np.array(img)
                        pixels = img_array.reshape(-1, 3).tolist()
                        print(f"      Downsampled from {original_size} to {len(pixels)} pixels")
                    
                    elif sample_method == "random" and original_size > max_pixels:
                        # Random sampling of pixels
                        img_array = np.array(img)
                        flat_pixels = img_array.reshape(-1, 3)
                        sample_indices = random.sample(range(len(flat_pixels)), max_pixels)
                        pixels = flat_pixels[sample_indices].tolist()
                        print(f"      Randomly sampled {len(pixels)} pixels from {original_size}")
                    
                    else:
                        # Use all pixels if under the limit
                        img_array = np.array(img)
                        pixels = img_array.reshape(-1, 3).tolist()
                    
                    # Create data structure according to user's request
                    entry = {
                        "year": year_int,
                        "colors": {
                            "image_name": img_name,
                            "color": pixels
                        }
                    }
                    
                    # Add to the main data
                    all_data.append(entry)
                    
                    print(f"      Extracted {len(pixels)} pixel colors")
            
            except Exception as e:
                print(f"      Error processing {img_name}: {e}")
    
    # Save to JSON file
    with open(output_file, 'w') as f:
        json.dump(all_data, f)
    
    print(f"\nColor extraction complete! Data saved to {output_file}")
    print(f"Processed {len(all_data)} year-image combinations.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract colors from images organized by year")
    parser.add_argument("--base-dir", default="yearly_photos", help="Base directory containing year folders")
    parser.add_argument("--output", default="colors_by_year.json", help="Output JSON file path")
    parser.add_argument("--max-pixels", type=int, default=10000, 
                       help="Maximum number of pixels to extract per image")
    parser.add_argument("--sample-method", choices=["resize", "random"], default="resize",
                       help="Method to reduce pixels: resize image or random sampling")
    
    args = parser.parse_args()
    
    extract_colors_by_year(args.base_dir, args.output, args.max_pixels, args.sample_method)