import os
import glob
import json
import random
from PIL import Image
import numpy as np
import argparse
from collections import defaultdict

def extract_unique_colors_by_year(base_dir="yearly_photos", output_file="unique_colors_history.json", 
                                 max_pixels=10000, sample_method="resize"):
    """
    Extract colors from images by year, only keeping colors that weren't seen in previous years.
    
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
    
    # Find all year directories and sort them chronologically
    year_dirs = [d for d in glob.glob(os.path.join(base_dir, "*")) if os.path.isdir(d)]
    if not year_dirs:
        print(f"No year directories found in {base_dir}")
        return
    
    # Filter and sort numeric year directories
    valid_year_dirs = []
    for year_dir in year_dirs:
        year_name = os.path.basename(year_dir)
        try:
            year_int = int(year_name)
            valid_year_dirs.append((year_int, year_dir))
        except ValueError:
            print(f"Skipping non-year directory: {year_name}")
            continue
    
    valid_year_dirs.sort()  # Sort by year
    
    print(f"Found {len(valid_year_dirs)} valid year directories")
    
    # Set to track all colors seen so far
    all_seen_colors = set()
    
    # Final data structure - an array of year objects
    result_data = []
    
    # Process each year directory chronologically
    for year_int, year_dir in valid_year_dirs:
        print(f"Processing year: {year_int}")
        
        # Set to track unique colors in this year
        year_colors = set()
        
        # Get image files in this year (excluding subdirectories)
        image_files = []
        for ext in ['jpg', 'jpeg', 'png', 'gif']:
            image_files.extend(glob.glob(os.path.join(year_dir, f"*.{ext}")))
            image_files.extend(glob.glob(os.path.join(year_dir, f"*.{ext.upper()}")))
        
        if not image_files:
            print(f"  No images found in year {year_int}")
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
                        pixels = img_array.reshape(-1, 3)
                    
                    elif sample_method == "random" and original_size > max_pixels:
                        # Random sampling of pixels
                        img_array = np.array(img)
                        flat_pixels = img_array.reshape(-1, 3)
                        sample_indices = random.sample(range(len(flat_pixels)), max_pixels)
                        pixels = flat_pixels[sample_indices]
                    
                    else:
                        # Use all pixels if under the limit
                        img_array = np.array(img)
                        pixels = img_array.reshape(-1, 3)
                    
                    # Convert NumPy uint8 values to standard Python ints and add to set
                    for pixel in pixels:
                        # Convert each uint8 value to int before creating the tuple
                        color_tuple = (int(pixel[0]), int(pixel[1]), int(pixel[2]))
                        year_colors.add(color_tuple)
                    
                    print(f"      Added colors from {len(pixels)} pixels to year set")
            
            except Exception as e:
                print(f"      Error processing {img_name}: {e}")
        
        # Find colors unique to this year (not seen in previous years)
        unique_colors = year_colors - all_seen_colors
        print(f"  Found {len(unique_colors)} unique colors in year {year_int}")
        
        # Add these colors to our "seen" set for future years
        all_seen_colors.update(year_colors)
        
        # Add to result data
        if unique_colors:
            # Convert tuples back to lists for JSON serialization
            unique_colors_list = [list(color) for color in unique_colors]
            result_data.append({
                "year": year_int,
                "color": unique_colors_list
            })
    
    # Save to JSON file
    with open(output_file, 'w') as f:
        json.dump(result_data, f)
    
    print(f"\nUnique color extraction complete! Data saved to {output_file}")
    print(f"Processed {len(valid_year_dirs)} years")
    
    # Report on the total unique colors found
    total_unique = sum(len(year_data["color"]) for year_data in result_data)
    print(f"Total unique colors across all years: {total_unique}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract unique colors by year")
    parser.add_argument("--base-dir", default="yearly_photos", help="Base directory containing year folders")
    parser.add_argument("--output", default="unique_colors_history.json", help="Output JSON file path")
    parser.add_argument("--max-pixels", type=int, default=10000, 
                       help="Maximum number of pixels to extract per image")
    parser.add_argument("--sample-method", choices=["resize", "random"], default="resize",
                       help="Method to reduce pixels: resize image or random sampling")
    
    args = parser.parse_args()
    
    extract_unique_colors_by_year(args.base_dir, args.output, args.max_pixels, args.sample_method)