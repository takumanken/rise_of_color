import os
import glob

# Configuration
PHOTOS_DIR = "yearly_photos"  # Base directory with year subfolders
DIRECTORIES_TO_CREATE = ["non_photos", "edit"]  # Directories to create in each year folder

def main():
    """Create specified directories in each year folder."""
    if not os.path.exists(PHOTOS_DIR):
        print(f"Error: Directory '{PHOTOS_DIR}' not found.")
        return
    
    # Find all year directories
    year_dirs = [d for d in glob.glob(os.path.join(PHOTOS_DIR, "*")) if os.path.isdir(d)]
    if not year_dirs:
        print(f"No year directories found in {PHOTOS_DIR}")
        return
    
    print(f"Found {len(year_dirs)} year directories")
    
    # Create directories in each year folder
    for year_dir in sorted(year_dirs):
        year = os.path.basename(year_dir)
        print(f"Processing year: {year}")
        
        for dir_name in DIRECTORIES_TO_CREATE:
            dir_path = os.path.join(year_dir, dir_name)
            if not os.path.exists(dir_path):
                os.makedirs(dir_path)
                print(f"  Created: {dir_path}")
            else:
                print(f"  Already exists: {dir_path}")
    
    print("\nDirectory creation complete!")

if __name__ == "__main__":
    main()