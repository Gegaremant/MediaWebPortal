import os
import shutil
import mimetypes
import time
import logging
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("worker")

METRICS_FILE = os.path.join(os.path.dirname(__file__), "sorting_metrics.json")

ARCHIVE_PATH = os.getenv("ARCHIVE_PATH", "/mnt/archive")
INBOX_PATH = os.path.join(ARCHIVE_PATH, "not_sorted")
AUTO_SORTED_PATH = os.path.join(ARCHIVE_PATH, "web_portal", "auto_sorted")

# Ensure directories exist
os.makedirs(INBOX_PATH, exist_ok=True)
os.makedirs(os.path.join(AUTO_SORTED_PATH, "video"), exist_ok=True)
os.makedirs(os.path.join(AUTO_SORTED_PATH, "photo"), exist_ok=True)
os.makedirs(os.path.join(AUTO_SORTED_PATH, "broken"), exist_ok=True)

PROCESS_DELAY = 1.0 # 1 file per second to avoid IO overload

def get_target_category(filepath):
    mime, _ = mimetypes.guess_type(filepath)
    if mime:
        if mime.startswith('video/'):
            return "video"
        elif mime.startswith('image/'):
            return "photo"
    
    # Fallback by extension if mimetype fails
    ext = filepath.lower().split('.')[-1]
    if ext in ['mp4', 'avi', 'mkv', 'mov', 'webm']:
        return "video"
    if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic']:
        return "photo"
        
    return "broken"

def read_control_state():
    control_file = os.path.join(os.path.dirname(__file__), "sorter_control.json")
    state = {"status": "running", "delay_ms": 1000, "batch_size": 30}
    if os.path.exists(control_file):
        try:
            with open(control_file, "r") as f:
                state.update(json.load(f))
        except:
            pass
    return state

def process_inbox():
    try:
        state = read_control_state()
        if state.get("status") in ["pause", "stopped"]:
            return False

        files = [f for f in os.listdir(INBOX_PATH) if os.path.isfile(os.path.join(INBOX_PATH, f))]
        if not files:
            return False # Nothing processed
            
        batch_size = state.get("batch_size", 30)
        delay_ms = state.get("delay_ms", 1000)
        
        batch_files = files[:batch_size]
            
        # Load metrics
        metrics = {}
        if os.path.exists(METRICS_FILE):
            try:
                with open(METRICS_FILE, "r") as f:
                    metrics = json.load(f)
            except:
                pass
                
        for f in batch_files:
            source = os.path.join(INBOX_PATH, f)
            category = get_target_category(source)
            target = os.path.join(AUTO_SORTED_PATH, category, f)
            
            logger.info(f"Moving {f} to {category}...")
            shutil.move(source, target)
            
            # Update metrics
            current_min = str(int(time.time() / 60) * 60)
            metrics[current_min] = metrics.get(current_min, 0) + 1
            
        # Save metrics once per batch
        recent_keys = sorted(metrics.keys())[-60:]
        metrics = {k: metrics[k] for k in recent_keys}
        
        with open(METRICS_FILE, "w") as f:
            json.dump(metrics, f)
            
        adaptive_mode = state.get("adaptive_mode", True)
        final_delay_ms = delay_ms
        
        if adaptive_mode:
            try:
                truenas_metrics_file = os.path.join(os.path.dirname(__file__), "truenas_metrics.json")
                if os.path.exists(truenas_metrics_file):
                    with open(truenas_metrics_file, "r") as f:
                        truenas_data = json.load(f)
                        loadavg = truenas_data.get("cpu", 0)
                        
                        # In main.py, loadavg is multiplied by 10. So loadavg of 1.0 = 10.
                        if loadavg > 40:
                            logger.warning(f"TrueNAS load is CRITICAL ({loadavg/10}). Pausing sorter for 10 seconds.")
                            final_delay_ms = 10000
                        elif loadavg > 10:
                            # Proportional delay: base_delay + (loadavg - 10) * 100ms
                            extra_delay = (loadavg - 10) * 100
                            final_delay_ms = delay_ms + extra_delay
                            logger.info(f"Adaptive Mode: TrueNAS load is {loadavg/10}. Delay increased to {final_delay_ms}ms.")
            except Exception as e:
                logger.error(f"Failed to read TrueNAS metrics for adaptive mode: {e}")

        # Rate limiting
        if final_delay_ms > 0:
            time.sleep(final_delay_ms / 1000.0)
            
        return True
    except Exception as e:
        logger.error(f"Error processing inbox: {e}")
        time.sleep(5) # Backoff on error
        return False

if __name__ == "__main__":
    logger.info("Worker started, watching inbox...")
    while True:
        processed_something = process_inbox()
        if not processed_something:
            # Idle sleep
            time.sleep(5)
