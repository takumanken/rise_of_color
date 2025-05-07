#!/usr/bin/env python
import json
import numpy as np
from sklearn.cluster import KMeans
import os
from collections import defaultdict

def unpack_rgb(packed_color):
    """Unpack a color from integer format to RGB components"""
    r = (packed_color >> 16) & 0xFF
    g = (packed_color >> 8) & 0xFF
    b = packed_color & 0xFF
    return [r, g, b]

def main():
    # Load color data
    print("Loading color data...")
    with open("unique_colors_history.json", "r") as f:
        color_data = json.load(f)

    # Sort by year
    color_data.sort(key=lambda x: x.get("year", 0))

    # Parameters
    k_values = [4, 8, 16, 32, 64]

    # Preprocess colors for efficiency
    unique_packed_set = set()  # Track seen packed colors
    all_seen_colors = []       # RGB unpacked colors for clustering

    # Year-by-year clustering results
    year_clusters = {}
    
    # Store previous centroids for warm starts
    prev_centroids = {}

    # Process each year chronologically
    for year_idx, year_data in enumerate(color_data):
        year = year_data.get("year", f"Unknown-{year_idx}")
        print(f"\nProcessing year {year}...")
        
        # Add new unique colors from this year
        new_unpacked_colors = []
        for packed_color in year_data.get("color", []):
            if packed_color not in unique_packed_set:
                unique_packed_set.add(packed_color)
                # Unpack the integer value to RGB components
                rgb_values = unpack_rgb(packed_color)
                new_unpacked_colors.append(rgb_values)
        
        all_seen_colors.extend(new_unpacked_colors)
        
        # Skip clustering if not enough colors yet
        if len(all_seen_colors) < max(k_values):
            print(f"  Not enough colors for clustering yet ({len(all_seen_colors)})")
            continue
        
        # Convert to float32 numpy array once for better performance
        X_all = np.asarray(all_seen_colors, dtype=np.float32)
        print(f"  Processing {len(X_all)} total colors")
        
        # Results for this year
        year_results = {}
        
        # Filter k values that are valid for the current number of colors
        valid_k_values = [k for k in k_values if len(all_seen_colors) >= k]
        
        # Process each k value with optimized settings
        for k in valid_k_values:
            print(f"  Clustering k={k}...")
            
            # Use warm start if we have previous centroids
            init = prev_centroids.get(k, "k-means++")
            
            # Optimized KMeans with float32 and single initialization
            kmeans = KMeans(
                n_clusters=k, 
                init=init,
                n_init=1,                # Single init is sufficient with fixed random_state
                algorithm="elkan",       # Faster for lower dimensions
                max_iter=300,
                tol=0.0001,
                random_state=42,
                # If scikit-learn version >= 1.4, use dtype parameter directly
                # dtype=np.float32,      # Uncomment for scikit-learn 1.4+
            )
            
            # Fit on float32 numpy array
            kmeans.fit(X_all)
            
            # Store centroids for warm start in next year
            prev_centroids[k] = kmeans.cluster_centers_
            
            # Vectorized counting of cluster members
            labels = kmeans.labels_
            counts = np.bincount(labels, minlength=k).tolist()
            
            # Direct conversion to int without intermediate calculations
            centroids = kmeans.cluster_centers_.astype(int).tolist()
            
            # Store results
            year_results[k] = {
                "centroids": centroids,
                "counts": counts,
                "total_colors": len(X_all)
            }
        
        # Store all k results for this year
        year_clusters[str(year)] = year_results  # Make sure year is stored as string

    # Create output data structure 
    output_data = {
        "total_unique_colors": len(unique_packed_set),
        "all_years": [year_data.get("year") for year_data in color_data],
        "year_clusters": year_clusters
    }

    # Save to file
    output_path = os.path.join("assets", "yearly_clustered_colors.json")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    print(f"\nSaving results to {output_path}")
    with open(output_path, "w") as f:
        json.dump(output_data, f)

    print("Done!")

if __name__ == '__main__':
    main()