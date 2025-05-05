import os
import sys
import shutil
from glob import glob

# Configuration
PHOTOS_DIR = "yearly_photos"  # Base directory with year subfolders

def restore_year_directory(year_dir):
    """Move files from non_photos back to the year directory."""
    # Get the non_photos directory
    non_photos_dir = os.path.join(year_dir, "non_photos")
    
    # Check if the non_photos directory exists
    if not os.path.exists(non_photos_dir) or not os.path.isdir(non_photos_dir):
        print(f"No non_photos directory found in {year_dir}")
        return 0
    
    # Get all image files in the non_photos directory
    image_files = glob(os.path.join(non_photos_dir, "*.jpg")) + \
                  glob(os.path.join(non_photos_dir, "*.jpeg")) + \
                  glob(os.path.join(non_photos_dir, "*.png")) + \
                  glob(os.path.join(non_photos_dir, "*.gif"))
    
    if not image_files:
        print(f"No image files found in {non_photos_dir}")
        return 0
    
    # Process each image
    print(f"Moving {len(image_files)} images from {non_photos_dir} back to {year_dir}...")
    move_count = 0
    
    for image_path in image_files:
        # Get the filename
        filename = os.path.basename(image_path)
        destination = os.path.join(year_dir, filename)
        
        # Check if the file already exists in the destination
        if os.path.exists(destination):
            print(f"  ⚠️ File already exists: {destination}")
            continue
        
        # Move the file
        try:
            shutil.move(image_path, destination)
            move_count += 1
            if move_count % 5 == 0 or move_count == len(image_files):
                print(f"  Moved {move_count}/{len(image_files)} files", end="\r")
        except Exception as e:
            print(f"  ⚠️ Failed to move {filename}: {e}")
    
    print(f"\nYear {os.path.basename(year_dir)}: Moved {move_count} files back to year directory")
    
    # Try to remove the now-empty non_photos directory
    if len(os.listdir(non_photos_dir)) == 0:
        try:
            os.rmdir(non_photos_dir)
            print(f"  Removed empty directory: {non_photos_dir}")
        except Exception as e:
            print(f"  ⚠️ Failed to remove directory {non_photos_dir}: {e}")
    
    return move_count

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
    total_moved = 0
    
    for year_dir in sorted(year_dirs):
        moved = restore_year_directory(year_dir)
        total_moved += moved
    
    # Print summary
    print("\n" + "="*50)
    print("RESTORE COMPLETE")
    print("="*50)
    print(f"Total files moved back to year directories: {total_moved}")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nProcess interrupted by user")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)