#!/usr/bin/env python3
"""Download historical photographs from Wikimedia Commons organized by year"""
from __future__ import annotations
import os
import time
import requests
import sys
import shutil
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, List

# Configuration
START_YEAR = 2024
END_YEAR = 2024
MAX_IMAGES_PER_YEAR = 500
THUMBNAIL_WIDTH = 800
OUTPUT_DIRECTORY = "yearly_photos"
API_DELAY = 0.5
MAX_WORKERS = 10

API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "DataAsMaterial/1.0 (course-project@parsons.edu)"

def fetch_batch(session: requests.Session, params: Dict[str, Any]) -> Dict[str, Any]:
    """Query the MediaWiki API and return parsed JSON."""
    r = session.get(API, params=params, timeout=30)
    r.raise_for_status()
    return r.json()

def get_file_extension(url):
    """Extract file extension from URL."""
    match = re.search(r'\.([a-zA-Z0-9]{1,4})$', url)
    return match.group(1).lower() if match else 'jpg'

def get_images_from_category(session: requests.Session, year: int, width: int, limit: int, delay: float) -> List[Dict]:
    """Get images from year category."""
    params = {
        "action": "query",
        "format": "json",
        "generator": "categorymembers",
        "gcmtitle": f"Category:{year}_photographs",
        "gcmtype": "file",
        "gcmlimit": "500",
        "prop": "imageinfo",
        "iiprop": "url",
        "iiurlwidth": str(width),
    }
    
    images = []
    
    print(f"Searching category: Category:{year}_photographs")
    
    while len(images) < limit:
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
            
            print(f"  Found {len(batch_images)} images in this batch, total: {len(images)}")
            
            if "continue" in data:
                if "iicontinue" in data["continue"]:
                    params["iicontinue"] = data["continue"]["iicontinue"]
                    if "continue" in data["continue"]:
                        params["continue"] = data["continue"]["continue"]
                    print(f"  Using iicontinue token")
                
                time.sleep(delay)
            else:
                print("  No continuation token found, ending search")
                break
            
            if len(images) >= limit:
                break
        except Exception as e:
            print(f"Error fetching batch: {e}")
            break
    
    return images[:limit]

def download_image(args):
    """Download a single image."""
    session, img, outdir = args
    page_id = img["page_id"]
    file_url = img["url"]
    
    try:
        extension = get_file_extension(file_url)
        filename = f"{page_id}.{extension}"
        filepath = os.path.join(outdir, filename)
        
        with session.get(file_url, stream=True, timeout=15) as response:
            response.raise_for_status()
            with open(filepath, "wb") as fh:
                for chunk in response.iter_content(262144):
                    fh.write(chunk)
        return True
    except:
        return False

def download_year_images(year: int, width: int, limit: int, delay: float, base_outdir: str) -> int:
    """Download images from a specific year's category"""
    outdir = os.path.join(base_outdir, f"{year}")
    
    if os.path.exists(outdir):
        shutil.rmtree(outdir)
    
    os.makedirs(outdir, exist_ok=True)
    
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    
    images = get_images_from_category(session, year, width, limit, delay)
    
    if not images:
        print(f"No images found for year {year}")
        return 0
    
    print(f"Year {year}: Found {len(images)} images - downloading...")
    
    download_sessions = [requests.Session() for _ in range(MAX_WORKERS)]
    for s in download_sessions:
        s.headers.update({"User-Agent": USER_AGENT})
    
    tasks = []
    for i, img in enumerate(images):
        session_idx = i % len(download_sessions)
        tasks.append((download_sessions[session_idx], img, outdir))
    
    successful = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_task = {executor.submit(download_image, task): task for task in tasks}
        
        for i, future in enumerate(as_completed(future_to_task)):
            if future.result():
                successful += 1
            
            if i % 50 == 0 and i > 0:
                print(f"  {i}/{len(tasks)} images processed...")
    
    print(f"Year {year}: Downloaded {successful}/{len(images)} images")
    return successful

def main() -> None:
    """Main entry point"""
    os.makedirs(OUTPUT_DIRECTORY, exist_ok=True)
    
    total_images = 0
    
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
    
    print(f"\nDOWNLOAD COMPLETE")
    print(f"Total images: {total_images}")
    print(f"Images saved to: {os.path.abspath(OUTPUT_DIRECTORY)}")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("\nInterrupted by user")
    except Exception as e:
        print(f"\nError: {e}")
        sys.exit(1)
