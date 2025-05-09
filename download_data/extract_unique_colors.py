#!/usr/bin/env python3
"""Extract unique colors from photographs by year"""
import os
import json
import pathlib
import time
from concurrent.futures import ProcessPoolExecutor
import numpy as np
from PIL import Image

BASE_DIR = "yearly_photos"
OUTPUT_FILE = "unique_colors_history.json"
MAX_WORKERS = os.cpu_count()
RESIZE_TO = 250
CHUNKSIZE = 8
COLOR_DEPTH = 5.5

def quantize_colors(flat_rgb):
    """Quantize colors"""
    factor = 2 ** (8 - COLOR_DEPTH)
    r = np.floor(flat_rgb[:, 0] / factor) * factor
    g = np.floor(flat_rgb[:, 1] / factor) * factor
    b = np.floor(flat_rgb[:, 2] / factor) * factor
    
    return (r.astype(np.uint32) << 16) | (g.astype(np.uint32) << 8) | b.astype(np.uint32)

def colors_in_image(path):
    """Extract unique colors from an image as packed integers"""
    try:
        with Image.open(path) as img:
            img.thumbnail((RESIZE_TO, RESIZE_TO), Image.LANCZOS)
            arr = np.asarray(img.convert("RGB"), dtype=np.float32)
            flat_rgb = arr.reshape(-1, 3)
            packed = quantize_colors(flat_rgb)
            return np.unique(packed)
    except Exception:
        return np.array([], dtype=np.uint32)

def extract_unique_colors_by_year():
    """Extract colors from images by year, tracking only new colors"""    
    base = pathlib.Path(BASE_DIR)
    year_dirs = sorted(
        (int(p.name), p) for p in base.iterdir() 
        if p.is_dir() and p.name.isdigit()
    )
    
    print(f"Found {len(year_dirs)} year directories")
    seen = set()
    result = []
    
    with ProcessPoolExecutor(max_workers=MAX_WORKERS) as pool:
        for year, year_path in year_dirs:
            print(f"Processing year {year}...")
            
            image_files = [
                f for f in year_path.iterdir() 
                if f.is_file() and f.suffix.lower() in ('.jpg', '.jpeg', '.png', '.gif')
            ]
            
            if not image_files:
                continue
                
            year_colors = set()
            for color_array in pool.map(colors_in_image, image_files, chunksize=CHUNKSIZE):
                if len(color_array) > 0:
                    year_colors.update(color_array)
            
            unique = year_colors.difference(seen)
            seen.update(year_colors)
            
            result.append({
                "year": year,
                "color": [int(x) for x in unique]
            })
            
            print(f"  Found {len(unique)} new colors")
    
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(result, f)
        
    print(f"Complete! Processed {len(year_dirs)} years")

if __name__ == "__main__":
    extract_unique_colors_by_year()