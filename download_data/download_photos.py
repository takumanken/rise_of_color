from __future__ import annotations
import argparse, os, time, requests, sys
import shutil
from typing import Dict, Any
from PIL import Image, ImageChops  # Added for image cropping
import re

#############################################
# CONFIGURATION - EDIT THESE VALUES AS NEEDED
#############################################
START_YEAR = 2001            # First year to download
END_YEAR = 2025              # Last year to download
MAX_IMAGES_PER_YEAR = 30     # Number of images to download per year
THUMBNAIL_WIDTH = 300        # Width of thumbnails in pixels
OUTPUT_DIRECTORY = "yearly_photos"  # Base directory for downloaded images
API_DELAY = 0.25              # Delay between API requests (seconds)
SUBDIRECTORIES = ["non_photos", "edit", "original"]  # Subdirectories to create in each year folder
AUTO_CROP = True             # Whether to automatically crop images after download
#############################################

API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "DataAsMaterial/1.0 (course-project@parsons.edu; https://github.com/parsons/data-as-material)"

def trim(im):
    """
    Crop an image by removing uniform color borders.
    Works well for images with solid-color frames.
    """
    # Create a background filled with the color of the top-left pixel
    bg = Image.new(im.mode, im.size, im.getpixel((0,0)))
    # Find the difference between the image and this background
    diff = ImageChops.difference(im, bg)
    # Enhance the difference to make the edge detection more robust
    diff = ImageChops.add(diff, diff, 2.0, -100)
    # Get the bounding box of the non-background area
    bbox = diff.getbbox()
    if bbox:
        return im.crop(bbox)
    return im  # Return original if no crop area found

def fetch_batch(session: requests.Session, params: Dict[str, Any]) -> Dict[str, Any]:
    """Query the MediaWiki API and return parsed JSON."""
    r = session.get(API, params=params, timeout=30)
    r.raise_for_status()
    return r.json()

def get_file_extension(url):
    """Extract file extension from URL."""
    # Match the last occurrence of a period followed by 1-4 chars at the end of the string
    match = re.search(r'\.([a-zA-Z0-9]{1,4})$', url)
    if match:
        return match.group(1).lower()
    return 'jpg'  # Default to jpg if no extension found

def download_year_images(year: int, width: int, limit: int, delay: float, base_outdir: str) -> int:
    """Download images from a specific year's category"""
    cat_title = f"Category:{year}_photographs"
    outdir = os.path.join(base_outdir, f"{year}")
    os.makedirs(outdir, exist_ok=True)
    
    # Create additional subdirectories
    for subdir in SUBDIRECTORIES:
        subdir_path = os.path.join(outdir, subdir)
        os.makedirs(subdir_path, exist_ok=True)
        print(f"Created directory: {subdir_path}")
    
    # Get path to original directory for non-cropped images
    original_dir = os.path.join(outdir, "original")
    
    params: Dict[str, Any] = {
        "action": "query",
        "format": "json",
        "generator": "categorymembers",
        "gcmtitle": cat_title,
        "gcmtype": "file",
        "gcmlimit": "50",
        "prop": "imageinfo",
        "iiprop": "url",
        "iiurlwidth": str(width),
    }
    
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    total = 0
    
    print(f"\n{'='*50}")
    print(f"YEAR: {year}")
    print(f"{'='*50}")
    print(f"Fetching up to {limit} thumbnails {width}px wide from {cat_title} …")
    
    try:
        while True and total < limit:
            data = fetch_batch(session, params)
            
            # Check if the category exists and has images
            if "query" not in data or "pages" not in data["query"]:
                print(f"⚠️ No images found for {cat_title}")
                break
                
            print(f"Retrieved {len(data['query']['pages'])} images in this batch")
            
            for page_id, page in data["query"]["pages"].items():
                if total >= limit:
                    break
                    
                # Skip pages without imageinfo
                if "imageinfo" not in page or not page["imageinfo"]:
                    continue
                    
                info = page["imageinfo"][0]
                file_url = info.get("thumburl")
                
                if not file_url:
                    print(f"⚠️ No thumbnail URL for {page.get('title', 'Unknown file')}")
                    continue
                
                # Get file extension from URL
                extension = get_file_extension(file_url)
                
                # Create filenames using the page ID instead of original filename
                id_filename = f"{page_id}.{extension}"
                filename = os.path.join(outdir, id_filename)
                original_filename = os.path.join(original_dir, id_filename)
                
                # Skip download if file already exists in either location
                if os.path.exists(filename) or os.path.exists(original_filename):
                    print(f"• Already have ID: {page_id}")
                    total += 1  # Count existing files toward the limit
                    continue
                
                # Download the image to a temporary location first
                temp_filename = os.path.join(outdir, f"temp_{id_filename}")
                print(f"⇩ ID: {page_id} ({page.get('title', 'Unknown')})")
                with session.get(file_url, stream=True, timeout=60) as img:
                    img.raise_for_status()
                    with open(temp_filename, "wb") as fh:
                        for chunk in img.iter_content(65536):
                            fh.write(chunk)
                
                # Auto-crop if enabled
                if AUTO_CROP:
                    try:
                        # Open the image
                        with Image.open(temp_filename) as im:
                            # Apply the trimming function
                            cropped_im = trim(im)
                            
                            # Check if cropping changed the image size
                            if cropped_im.size != im.size:
                                # Save original to the original directory
                                shutil.copy2(temp_filename, original_filename)
                                print(f"📦 Original saved to: original/{id_filename}")
                                
                                # Save cropped version to the main directory
                                cropped_im.save(filename)
                                print(f"✂️ Cropped version saved as: {id_filename}")
                            else:
                                # No cropping needed, just move to the main location
                                print(f"• No border detected for ID: {page_id}")
                                shutil.move(temp_filename, filename)
                    except Exception as e:
                        print(f"⚠️ Error cropping ID {page_id}: {e}")
                        # On error, just move the temp file to the main location
                        if os.path.exists(temp_filename):
                            shutil.move(temp_filename, filename)
                else:
                    # No cropping requested, just move to the main location
                    shutil.move(temp_filename, filename)
                
                # Clean up temp file if it still exists
                if os.path.exists(temp_filename):
                    os.remove(temp_filename)
                
                total += 1
            
            # Break if we've reached the limit or there are no more results
            if total >= limit or "continue" not in data:
                break
                
            params["gcmcontinue"] = data["continue"]["gcmcontinue"]
            time.sleep(delay)
            
        print(f"✔ Downloaded {total} files from {year} to {outdir}")
        return total
        
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            print(f"❌ Category {cat_title} does not exist")
            return 0
        else:
            print(f"❌ HTTP error: {e}")
            return 0
    except Exception as e:
        print(f"❌ Error downloading {year} images: {e}")
        return 0

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download Wikimedia Commons thumbnails from yearly categories"
    )
    parser.add_argument(
        "--start-year",
        type=int,
        default=START_YEAR,
        help=f"Start year (default: {START_YEAR})"
    )
    parser.add_argument(
        "--end-year",
        type=int,
        default=END_YEAR,
        help=f"End year (default: {END_YEAR})"
    )
    parser.add_argument(
        "-w",
        "--width",
        type=int,
        default=THUMBNAIL_WIDTH,
        help=f"Thumbnail width in pixels (default: {THUMBNAIL_WIDTH})",
    )
    parser.add_argument(
        "-o",
        "--outdir",
        default=OUTPUT_DIRECTORY,
        help=f"Base output directory (default: {OUTPUT_DIRECTORY})",
    )
    parser.add_argument(
        "-d",
        "--delay",
        type=float,
        default=API_DELAY,
        help=f"Politeness delay between API calls in seconds (default: {API_DELAY})",
    )
    parser.add_argument(
        "-l",
        "--limit",
        type=int,
        default=MAX_IMAGES_PER_YEAR,
        help=f"Maximum number of images per year (default: {MAX_IMAGES_PER_YEAR})",
    )
    parser.add_argument(
        "--no-crop",
        action="store_true",
        help="Disable automatic image cropping"
    )

    args = parser.parse_args()
    os.makedirs(args.outdir, exist_ok=True)
    
    # Set auto-crop based on command line argument
    global AUTO_CROP
    if args.no_crop:
        AUTO_CROP = False
    
    total_images = 0
    total_years_found = 0
    
    print(f"Downloading images from years {args.start_year} to {args.end_year}...")
    print(f"Images will be saved using their MediaWiki page IDs as filenames")
    if AUTO_CROP:
        print("Auto-cropping is ENABLED - cropped images in main folder, originals in 'original' folder")
    else:
        print("Auto-cropping is DISABLED")
    
    for year in range(args.start_year, args.end_year + 1):
        images_downloaded = download_year_images(
            year=year,
            width=args.width,
            limit=args.limit,
            delay=args.delay,
            base_outdir=args.outdir
        )
        
        total_images += images_downloaded
        if images_downloaded > 0:
            total_years_found += 1
    
    print(f"\n{'='*50}")
    print(f"DOWNLOAD COMPLETE")
    print(f"{'='*50}")
    print(f"Years searched: {args.end_year - args.start_year + 1}")
    print(f"Years with images: {total_years_found}")
    print(f"Total images downloaded: {total_images}")
    print(f"Images saved to: {os.path.abspath(args.outdir)}")
    print(f"Files are named using their MediaWiki page IDs (e.g., 12345678.jpg)")
    if AUTO_CROP:
        print(f"Cropped versions in main directories, originals saved in 'original' subdirectories")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("\nInterrupted by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
