#!/usr/bin/env python3
"""
Extract unique colors from photographs by year
Only keeps colors that weren't seen in any previous year
"""
import os
import json
import pathlib
import time
from concurrent.futures import ProcessPoolExecutor
import numpy as np
from PIL import Image
import math

#############################################
# CONFIGURATION
#############################################
BASE_DIR = "yearly_photos"                 # Base directory containing year folders
OUTPUT_FILE = "unique_colors_history.json" # Output JSON file path
MAX_WORKERS = os.cpu_count()               # Parallel processing workers
RESIZE_TO = 250                            # Smaller resize for better performance
CHUNKSIZE = 8                              # Larger chunks for better parallel performance
COLOR_DEPTH = 5.5                          # Match frontend color depth
#############################################

def quantize_colors(flat_rgb):
    """Quantize colors using exactly the same logic as the frontend"""
    # Use same formula as JavaScript: factor = Math.pow(2, 8 - CONFIG.colorDepth)
    factor = 2 ** (8 - COLOR_DEPTH)
    
    # Apply quantization (floor(value/factor)*factor)
    r = np.floor(flat_rgb[:, 0] / factor) * factor
    g = np.floor(flat_rgb[:, 1] / factor) * factor
    b = np.floor(flat_rgb[:, 2] / factor) * factor
    
    # Pack into integers
    return (r.astype(np.uint32) << 16) | (g.astype(np.uint32) << 8) | b.astype(np.uint32)

def colors_in_image(path):
    """Extract unique colors from an image as packed integers"""
    try:
        with Image.open(path) as img:
            img.thumbnail((RESIZE_TO, RESIZE_TO), Image.LANCZOS)
            arr = np.asarray(img.convert("RGB"), dtype=np.float32)  # Use float32 for division
            flat_rgb = arr.reshape(-1, 3)
            
            # Apply color quantization exactly like the frontend
            packed = quantize_colors(flat_rgb)
            
            return np.unique(packed)
    except Exception:
        return np.array([], dtype=np.uint32)

def extract_unique_colors_by_year():
    """Extract colors from images by year, only keeping colors that weren't seen in previous years."""
    start_time = time.time()
    
    # Find and sort year directories
    base = pathlib.Path(BASE_DIR)
    year_dirs = sorted(
        (int(p.name), p) for p in base.iterdir() 
        if p.is_dir() and p.name.isdigit()
    )
    
    print(f"Found {len(year_dirs)} year directories")
    seen = set()  # Track all colors seen so far
    result = []   # Final data structure
    
    # Process years sequentially
    with ProcessPoolExecutor(max_workers=MAX_WORKERS) as pool:
        for year, year_path in year_dirs:
            print(f"Processing year {year}...")
            
            # Find all image files
            image_files = [
                f for f in year_path.iterdir() 
                if f.is_file() and f.suffix.lower() in ('.jpg', '.jpeg', '.png', '.gif')
            ]
            
            if not image_files:
                continue
                
            # Process images in parallel
            year_colors = set()
            for color_array in pool.map(colors_in_image, image_files, chunksize=CHUNKSIZE):
                if len(color_array) > 0:
                    year_colors.update(color_array)
            
            # Find colors unique to this year
            unique = year_colors.difference(seen)
            seen.update(year_colors)
            
            # Add to results
            result.append({
                "year": year,
                "color": [int(x) for x in unique]
            })
            
            print(f"  Found {len(unique)} new colors")
    
    # Save to JSON file
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(result, f)
    
    # Calculate file size
    file_size = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)  # Size in MB
    
    print(f"Complete! Processed {len(year_dirs)} years")
    print(f"Output file size: {file_size:.2f} MB")
    print(f"Total processing time: {time.time() - start_time:.1f} seconds")

if __name__ == "__main__":
    extract_unique_colors_by_year()