import os
import shutil
import time
import json
from datetime import datetime
import concurrent.futures

BASE_DIR = '/mnt/archive/Not_sorted'
TARGET_VIDEOS = '/mnt/archive/Web_portal/Auto_sorted/video'
TARGET_PICTURES = '/mnt/archive/Web_portal/Auto_sorted/photos'
TARGET_BROKEN = '/mnt/archive/Web_portal/Auto_sorted/brocken'
TARGET_DUPLICATES = '/mnt/archive/Web_portal/Auto_sorted/duplicates'

os.makedirs(TARGET_VIDEOS, exist_ok=True)
os.makedirs(TARGET_PICTURES, exist_ok=True)
os.makedirs(TARGET_BROKEN, exist_ok=True)
os.makedirs(TARGET_DUPLICATES, exist_ok=True)

video_exts = {'.mp4', '.avi', '.mov', '.mkv', '.webm'}
img_exts = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}

CONTROL_FILE = os.path.join(os.path.dirname(__file__), 'sorter_control.json')
METRICS_FILE = os.path.join(os.path.dirname(__file__), 'sorting_metrics.json')
DUPLICATES_FILE = os.path.join(os.path.dirname(__file__), 'duplicates.json')

def get_control_state():
    if os.path.exists(CONTROL_FILE):
        try:
            with open(CONTROL_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {"status": "running", "delay_ms": 0}

def update_metrics(speed, total):
    try:
        with open(METRICS_FILE, 'w') as f:
            json.dump({"speed": speed, "total_moved": total, "last_update": str(datetime.now())}, f)
    except:
        pass

def add_duplicate_alert(src, target_dir, file_name, file_size):
    dupes = []
    if os.path.exists(DUPLICATES_FILE):
        try:
            with open(DUPLICATES_FILE, 'r') as f:
                dupes = json.load(f)
        except:
            pass
            
    base, ex = os.path.splitext(file_name)
    counter = 1
    dst_dupe = os.path.join(TARGET_DUPLICATES, file_name)
    while os.path.exists(dst_dupe):
        dst_dupe = os.path.join(TARGET_DUPLICATES, f"{base}_{counter}{ex}")
        counter += 1
        
    try:
        shutil.move(src, dst_dupe)
        
        dupes.append({
            "id": str(int(time.time() * 1000)),
            "duplicate_path": dst_dupe,
            "original_dir": target_dir,
            "original_name": file_name,
            "size": file_size,
            "time": str(datetime.now())
        })
        
        with open(DUPLICATES_FILE, 'w') as f:
            json.dump(dupes, f)
    except:
        pass

def process_single_file(src):
    f = os.path.basename(src)
    ext = os.path.splitext(f)[1].lower()
    
    if ext in video_exts:
        dst_dir = TARGET_VIDEOS
    elif ext in img_exts:
        dst_dir = TARGET_PICTURES
    else:
        dst_dir = TARGET_BROKEN

    dst = os.path.join(dst_dir, f)
    base, ex = os.path.splitext(f)
    
    if os.path.exists(dst):
        try:
            src_size = os.path.getsize(src)
            dst_size = os.path.getsize(dst)
            if src_size == dst_size:
                add_duplicate_alert(src, dst_dir, f, src_size)
                return True
            else:
                counter = 1
                while os.path.exists(dst):
                    dst = os.path.join(dst_dir, f'{base}_{counter}{ex}')
                    counter += 1
        except:
            pass
            
    try:
        shutil.move(src, dst)
        return True
    except Exception as e:
        return False

def main():
    moved_total = 0
    
    # Read metrics file to restore moved_total if available
    try:
        if os.path.exists(METRICS_FILE):
            with open(METRICS_FILE, 'r') as f:
                d = json.load(f)
                moved_total = d.get("total_moved", 0)
    except:
        pass
        
    last_metrics_time = time.time()
    files_since_last_metric = 0

    while True:
        state = get_control_state()
        if state.get("status") == "stopped":
            break
        if state.get("status") == "paused":
            time.sleep(1)
            continue
            
        delay_ms = state.get("delay_ms", 0)
        
        # Collect batch
        files_to_process = []
        for root, dirs, files in os.walk(BASE_DIR):
            for f in files:
                files_to_process.append(os.path.join(root, f))
                if len(files_to_process) >= 500: # process in chunks of 500
                    break
            if len(files_to_process) >= 500:
                break
                
        if not files_to_process:
            update_metrics(0, moved_total)
            for root, dirs, files in os.walk(BASE_DIR, topdown=False):
                for d in dirs:
                    dir_path = os.path.join(root, d)
                    try:
                        if not os.listdir(dir_path):
                            os.rmdir(dir_path)
                    except Exception:
                        pass
            time.sleep(5)
            continue
            
        # Multithreaded processing
        with concurrent.futures.ThreadPoolExecutor(max_workers=32) as executor:
            futures = {executor.submit(process_single_file, src): src for src in files_to_process}
            
            for future in concurrent.futures.as_completed(futures):
                state = get_control_state()
                if state.get("status") != "running":
                    break
                
                success = future.result()
                if success:
                    moved_total += 1
                    files_since_last_metric += 1
                
                delay_ms = state.get("delay_ms", 0)
                if delay_ms > 0:
                    time.sleep(delay_ms / 1000.0)
                    
                if time.time() - last_metrics_time > 2.0:
                    speed = files_since_last_metric / (time.time() - last_metrics_time)
                    update_metrics(round(speed, 2), moved_total)
                    files_since_last_metric = 0
                    last_metrics_time = time.time()
                    
        # Cleanup empty dirs
        for root, dirs, files in os.walk(BASE_DIR, topdown=False):
            for d in dirs:
                dir_path = os.path.join(root, d)
                try:
                    if not os.listdir(dir_path):
                        os.rmdir(dir_path)
                except Exception:
                    pass

        time.sleep(1)

if __name__ == '__main__':
    main()
