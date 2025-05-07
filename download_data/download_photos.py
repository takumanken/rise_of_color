from __future__ import annotations
import os, time, requests, sys, shutil
from typing import Dict, Any, List
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

#############################################
# CONFIGURATION - EDIT THESE VALUES AS NEEDED
#############################################
START_YEAR = 1901            # First year to download
END_YEAR = 2025              # Last year to download
MAX_IMAGES_PER_YEAR = 500    # Maximum images per year
THUMBNAIL_WIDTH = 800        # Width for better quality
OUTPUT_DIRECTORY = "yearly_photos"  # Base directory
API_DELAY = 0.01             # Even faster delay
CLEAR_YEAR_FOLDER = True     # Clear year folder before downloading
MAX_WORKERS = 10             # Parallel downloads
MINIMAL_LOGGING = True       # Reduce console output for speed
#############################################

API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "DataAsMaterial/1.0 (course-project@parsons.edu; https://github.com/parsons/data-as-material)"

def fetch_batch(session: requests.Session, params: Dict[str, Any]) -> Dict[str, Any]:
    """Query the MediaWiki API and return parsed JSON."""
    r = session.get(API, params=params, timeout=30)
    r.raise_for_status()
    return r.json()

def get_file_extension(url):
    """Extract file extension from URL."""
    match = re.search(r'\.([a-zA-Z0-9]{1,4})$', url)
    if match:
        return match.group(1).lower()
    return 'jpg'  # Default to jpg if no extension found

def get_images_from_category(session: requests.Session, year: int, width: int, limit: int, delay: float) -> List[Dict]:
    """Get images from year category - SPEED OPTIMIZED."""
    params = {
        "action": "query",
        "format": "json",
        "generator": "categorymembers",
        "gcmtitle": f"Category:{year}_photographs",
        "gcmtype": "file",
        "gcmlimit": "500",  # Maximum allowed by API
        "prop": "imageinfo",
        "iiprop": "url",
        "iiurlwidth": str(width),
    }
    
    images = []
    continuation_key = None
    debug_printed = False  # Flag to ensure we only print once
    
    if not MINIMAL_LOGGING:
        print(f"Searching category: Category:{year}_photographs")
    
    while len(images) < limit:
        if continuation_key:
            params["gcmcontinue"] = continuation_key
        
        try:
            data = fetch_batch(session, params)
            
            if "query" not in data or "pages" not in data["query"]:
                break
            
            batch_images = []
            for page_id, page in data["query"]["pages"].items():
                if "imageinfo" in page and page["imageinfo"]:
                    info = page["imageinfo"][0]
                    if "thumburl" in info:
                        batch_images.append({
                            "page_id": page_id,
                            "url": info["thumburl"]
                        })
            
            images.extend(batch_images)
            
            if not MINIMAL_LOGGING:
                print(f"  Found {len(batch_images)} images in this batch, total: {len(images)}")
            
            if "continue" in data:
                # Handle different types of continuation tokens
                if "gcmcontinue" in data["continue"]:
                    params["gcmcontinue"] = data["continue"]["gcmcontinue"]
                    if "continue" in data["continue"]:
                        params["continue"] = data["continue"]["continue"]
                    print(f"  Using gcmcontinue token: {data['continue']['gcmcontinue'][:20]}...")
                elif "iicontinue" in data["continue"]:
                    params["iicontinue"] = data["continue"]["iicontinue"]
                    if "continue" in data["continue"]:
                        params["continue"] = data["continue"]["continue"]
                    print(f"  Using iicontinue token: {data['continue']['iicontinue'][:20]}...")
                
                time.sleep(delay)
            else:
                print("  No continuation token found, ending search")
                break
            
            if len(images) >= limit:
                break
        except Exception as e:
            if not MINIMAL_LOGGING:
                print(f"Error fetching batch: {e}")
            break
    
    return images[:limit]

def download_image(args):
    """Download a single image - for parallel execution."""
    session, img, outdir = args
    page_id = img["page_id"]
    file_url = img["url"]
    
    try:
        extension = get_file_extension(file_url)
        id_filename = f"{page_id}.{extension}"
        download_filename = os.path.join(outdir, id_filename)
        
        with session.get(file_url, stream=True, timeout=15) as response:
            response.raise_for_status()
            with open(download_filename, "wb") as fh:
                for chunk in response.iter_content(262144):  # 256KB chunks
                    fh.write(chunk)
        return True
    except:
        return False

def download_year_images(year: int, width: int, limit: int, delay: float, base_outdir: str) -> int:
    """Download images from a specific year's category - SPEED OPTIMIZED"""
    outdir = os.path.join(base_outdir, f"{year}")
    
    # Clear year folder if requested
    if CLEAR_YEAR_FOLDER and os.path.exists(outdir):
        if not MINIMAL_LOGGING:
            print(f"Clearing existing folder: {outdir}")
        shutil.rmtree(outdir)
    
    # Create year directory
    os.makedirs(outdir, exist_ok=True)
    
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    
    # Get images from category
    images = get_images_from_category(session, year, width, limit, delay)
    
    if not images:
        print(f"No images found for year {year}")
        return 0
    
    print(f"Year {year}: Found {len(images)} images - downloading...")
    
    # Prepare download sessions - one per worker
    download_sessions = [requests.Session() for _ in range(MAX_WORKERS)]
    for s in download_sessions:
        s.headers.update({"User-Agent": USER_AGENT})
    
    # Create download tasks
    tasks = []
    for i, img in enumerate(images):
        session_idx = i % len(download_sessions)
        tasks.append((download_sessions[session_idx], img, outdir))
    
    # Parallel download with thread pool
    successful = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_task = {executor.submit(download_image, task): task for task in tasks}
        
        for i, future in enumerate(as_completed(future_to_task)):
            if future.result():
                successful += 1
            
            # Minimal progress reporting
            if i % 50 == 0 and i > 0 and not MINIMAL_LOGGING:
                print(f"  {i}/{len(tasks)} images processed...")
    
    print(f"Year {year}: Downloaded {successful}/{len(images)} images")
    return successful

def main() -> None:
    """Main entry point - SPEED OPTIMIZED"""
    os.makedirs(OUTPUT_DIRECTORY, exist_ok=True)
    
    total_images = 0
    start_time = time.time()
    
    for year in range(START_YEAR, END_YEAR + 1):
        year_start = time.time()
        images_downloaded = download_year_images(
            year=year,
            width=THUMBNAIL_WIDTH,
            limit=MAX_IMAGES_PER_YEAR,
            delay=API_DELAY,
            base_outdir=OUTPUT_DIRECTORY
        )
        
        year_time = time.time() - year_start
        print(f"Year {year} completed in {year_time:.1f} seconds ({images_downloaded} images)")
        total_images += images_downloaded
    
    elapsed = time.time() - start_time
    print(f"\nDOWNLOAD COMPLETE")
    print(f"Total images: {total_images}")
    print(f"Time: {elapsed:.1f} seconds ({total_images/elapsed:.1f} images/second)")
    print(f"Images saved to: {os.path.abspath(OUTPUT_DIRECTORY)}")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("\nInterrupted by user")
    except Exception as e:
        print(f"\nError: {e}")
        sys.exit(1)
