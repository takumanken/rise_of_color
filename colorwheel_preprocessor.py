#!/usr/bin/env python3
# colorwheel_preprocessor.py
import json
import math
import colorsys
import numpy as np
from pathlib import Path

# Configuration (matching your JavaScript settings)
CONFIG = {
    "grayscaleThreshold": 0.15,
    "darkBoostThreshold": 0.5,
    "darkColorBoost": 1,
    "colorDepth": 4,  # Color bit depth (1-8)
    "maxColors": 10000,  # Maximum colors to include
}

def rgb_to_hsl(r, g, b):
    """Convert RGB color to HSL color space"""
    # Normalize RGB values to 0-1 range
    r, g, b = r/255.0, g/255.0, b/255.0
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return h, s, l

def grey_angle(rgb):
    """Create a deterministic angle for grayscale colors"""
    r, g, b = rgb
    # Create a hash from RGB values
    hash_val = (r * 31 + g * 17 + b * 7) % 360
    # Convert to radians
    return (hash_val / 360.0) * 2 * math.pi

def quantize_color(rgb):
    """Reduce color depth to minimize unique colors"""
    r, g, b = rgb
    factor = 2 ** (8 - CONFIG["colorDepth"])
    
    # Basic quantization without jitter (for deterministic results)
    return [
        int(math.floor(r / factor) * factor),
        int(math.floor(g / factor) * factor),
        int(math.floor(b / factor) * factor)
    ]

def calculate_position(rgb, radius=100):
    """Calculate position on color wheel based on RGB"""
    # Convert to HSL
    h, s, l = rgb_to_hsl(*rgb)
    
    # Calculate angle based on hue or grayscale position
    if s < CONFIG["grayscaleThreshold"]:
        angle = grey_angle(rgb)
    else:
        angle = 2 * math.pi * h
    
    # Calculate distance from center based on lightness
    dist = (1 - l) * radius
    
    # Apply dark boost if needed
    if l < CONFIG["darkBoostThreshold"]:
        dist = min(radius, dist * CONFIG["darkColorBoost"])
    
    # Adjust grayscale position
    if s < CONFIG["grayscaleThreshold"]:
        dist *= 0.8
    
    # Calculate x, y coordinates
    x = dist * math.cos(angle)
    y = dist * math.sin(angle)
    
    return {
        "x": x,
        "y": y,
        "rgb": rgb,
        "angle": angle,
        "dist": dist,
        "h": h,
        "s": s,
        "l": l
    }

def process_data(input_file, output_file):
    """Process the color history data"""
    # Load the original data
    with open(input_file, 'r') as f:
        raw_data = json.load(f)
    
    # Output structure
    output_data = []
    
    # Track unique colors
    seen_colors = set()
    all_colors = []
    
    # Process each year
    for year_data in raw_data:
        year = year_data["year"]
        new_colors = []
        
        # Process each color in this year
        for rgb in year_data["color"]:
            # Quantize the color
            quantized = quantize_color(rgb)
            color_key = f"{quantized[0]},{quantized[1]},{quantized[2]}"
            
            # Add if we haven't seen this color before
            if color_key not in seen_colors:
                seen_colors.add(color_key)
                
                # Calculate position
                position_data = calculate_position(quantized)
                
                # Add to new colors for this year
                new_colors.append(position_data)
                
                # Add to all colors (for limiting)
                all_colors.append(position_data)
                
                # Stop if we've reached the maximum
                if len(all_colors) >= CONFIG["maxColors"]:
                    print(f"Reached maximum color limit ({CONFIG['maxColors']})")
                    break
        
        # Add this year's data
        output_data.append({
            "year": year,
            "colors": new_colors
        })
        
        if len(all_colors) >= CONFIG["maxColors"]:
            break
    
    print(f"Total unique colors processed: {len(all_colors)}")
    
    # Save the processed data
    with open(output_file, 'w') as f:
        json.dump(output_data, f)
    
    print(f"Processed data saved to {output_file}")

if __name__ == "__main__":
    input_file = "unique_colors_history.json"
    output_file = "processed_colors.json"
    process_data(input_file, output_file)