#!/usr/bin/env python
"""Cluster colors extracted from historical photographs"""
import json
import os
import numpy as np
from sklearn.cluster import KMeans

def unpack_rgb(packed_color):
    """Unpack a color from integer format to RGB components"""
    r = (packed_color >> 16) & 0xFF
    g = (packed_color >> 8) & 0xFF
    b = packed_color & 0xFF
    return [r, g, b]

def main():
    print("Loading color data...")
    with open("unique_colors_history.json", "r") as f:
        color_data = json.load(f)
    
    color_data.sort(key=lambda x: x.get("year", 0))
    k_values = [4, 8, 16, 32, 64]
    
    unique_colors = set()
    unpacked_colors = []
    year_clusters = {}
    prev_centroids = {}

    for year_data in color_data:
        year = year_data.get("year")
        print(f"\nProcessing year {year}...")
        
        # Add new colors from this year
        for packed_color in year_data.get("color", []):
            if packed_color not in unique_colors:
                unique_colors.add(packed_color)
                unpacked_colors.append(unpack_rgb(packed_color))
                
        X = np.asarray(unpacked_colors, dtype=np.float32)
        print(f"  Processing {len(X)} total colors")
        
        year_results = {}
        valid_k_values = [k for k in k_values if len(unpacked_colors) >= k]
        
        for k in valid_k_values:
            print(f"  Clustering k={k}...")
            
            kmeans = KMeans(
                n_clusters=k, 
                init=prev_centroids.get(k, "k-means++"),
                n_init=1,
                algorithm="elkan",
                max_iter=300,
                tol=0.0001,
                random_state=42,
            )
            
            kmeans.fit(X)
            prev_centroids[k] = kmeans.cluster_centers_
            
            labels = kmeans.labels_
            counts = np.bincount(labels, minlength=k).tolist()
            centroids = kmeans.cluster_centers_.astype(int).tolist()
            
            year_results[k] = {
                "centroids": centroids,
                "counts": counts,
                "total_colors": len(X)
            }
        
        year_clusters[str(year)] = year_results

    output_data = {
        "total_unique_colors": len(unique_colors),
        "all_years": [d.get("year") for d in color_data],
        "year_clusters": year_clusters
    }

    output_path = os.path.join("assets", "yearly_clustered_colors.json")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    print(f"\nSaving results to {output_path}")
    
    with open(output_path, "w") as f:
        json.dump(output_data, f)

    print("Done!")

if __name__ == '__main__':
    main()