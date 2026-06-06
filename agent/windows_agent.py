import psutil
from fastapi import FastAPI
import uvicorn
import time
import threading
import subprocess

app = FastAPI()

last_net_io = psutil.net_io_counters()
last_disk_io = psutil.disk_io_counters()
last_time = time.time()

import json
import urllib.request
import ssl
import os

truenas_cache = {"cpu": 0, "ram": 0, "net_tx": 0, "net_rx": 0, "disk_read": 0, "disk_write": 0, "disks": []}

def poll_truenas_from_windows():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    app_path = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(app_path, ".env")
    truenas_ip = "192.168.9.223"
    truenas_token = "1-OxImUZXxUUxutOSGv6HGCZMwI5vnQWDx97V58msB47NG9bWungrIe9U3GsofKGOf"
    
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("truenas_ip_in"):
                    truenas_ip = line.split("=", 1)[1].strip()
                elif line.startswith("truenas_api"):
                    truenas_token = line.split("=", 1)[1].strip()

    while not stop_event.is_set():
        url = f"https://{truenas_ip}/api/v2.0/reporting/get_data" if "://" not in truenas_ip else f"{truenas_ip}/api/v2.0/reporting/get_data"
        if not url.startswith("http"): url = "http://" + url
        req = urllib.request.Request(url, method="POST")
        req.add_header("Authorization", f"Bearer {truenas_token}")
        req.add_header("Content-Type", "application/json")
        try:
            # Fallback to system info for now as a dummy test since reporting endpoints can be tricky
            url_info = url.replace("reporting/get_data", "system/info")
            req_info = urllib.request.Request(url_info, method="GET")
            req_info.add_header("Authorization", f"Bearer {truenas_token}")
            with urllib.request.urlopen(req_info, context=ctx, timeout=3) as res:
                info = json.loads(res.read().decode())
                truenas_cache["cpu"] = info.get("loadavg", [0])[0] * 10
                truenas_cache["ram"] = info.get("physmem", 0) / 1000000000
                truenas_cache["disks"] = [{"device": "pool", "percent": 50, "total": 100000, "free": 50000}]
        except Exception as e:
            print("TrueNAS poll error:", e)
            pass
        stop_event.wait(5)

threading.Thread(target=poll_truenas_from_windows, daemon=True).start()

@app.get("/metrics")
def get_metrics():
    global last_net_io, last_time, last_disk_io
    
    current_time = time.time()
    current_net_io = psutil.net_io_counters()
    current_disk_io = psutil.disk_io_counters()
    
    time_diff = current_time - last_time
    
    # Calculate bytes per second
    bytes_sent_per_sec = (current_net_io.bytes_sent - last_net_io.bytes_sent) / time_diff if time_diff > 0 else 0
    bytes_recv_per_sec = (current_net_io.bytes_recv - last_net_io.bytes_recv) / time_diff if time_diff > 0 else 0
    
    disk_read_per_sec = (current_disk_io.read_bytes - last_disk_io.read_bytes) / time_diff if time_diff > 0 else 0
    disk_write_per_sec = (current_disk_io.write_bytes - last_disk_io.write_bytes) / time_diff if time_diff > 0 else 0
    
    last_net_io = current_net_io
    last_disk_io = current_disk_io
    last_time = current_time

    # Disks
    disks = []
    for part in psutil.disk_partitions(all=False):
        if part.fstype != '':
            try:
                usage = psutil.disk_usage(part.mountpoint)
                disks.append({
                    "device": part.device,
                    "percent": usage.percent,
                    "total": usage.total,
                    "free": usage.free
                })
            except:
                pass

    return {
        "cpu": psutil.cpu_percent(interval=0.1),
        "ram": psutil.virtual_memory().percent,
        "net_tx": bytes_sent_per_sec,
        "net_rx": bytes_recv_per_sec,
        "disk_read": disk_read_per_sec,
        "disk_write": disk_write_per_sec,
        "disks": disks,
        "boot_time": psutil.boot_time(),
        "truenas": truenas_cache
    }

@app.get("/processes")
def get_processes():
    procs = []
    for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info']):
        try:
            info = p.info
            procs.append({
                "pid": info['pid'],
                "name": info['name'],
                "cpu": info['cpu_percent'],
                "ram": info['memory_info'].rss
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    return procs

@app.post("/kill/{pid}")
def kill_process(pid: int):
    try:
        p = psutil.Process(pid)
        p.terminate()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/reboot")
def reboot_system():
    import os
    os.system("shutdown /r /t 0")
    return {"success": True}

stop_event = threading.Event()
current_ssh_process = None
server = None
tray_icon = None

def maintain_ssh_tunnel():
    global current_ssh_process
    while not stop_event.is_set():
        print("Starting SSH Tunnel...")
        try:
            # -N: Do not execute a remote command
            # -R: Reverse port forwarding
            # -o StrictHostKeyChecking=no: Auto-accept new host keys
            cmd = [
                "ssh", "-N",
                "-R", "4450:127.0.0.1:445",
                "-R", "8001:127.0.0.1:8001",
                "root@138.124.77.191",
                "-o", "StrictHostKeyChecking=no",
                "-o", "ServerAliveInterval=15",
                "-o", "ServerAliveCountMax=3"
            ]
            kwargs = {}
            if os.name == 'nt':
                kwargs['creationflags'] = 0x08000000  # CREATE_NO_WINDOW
            current_ssh_process = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **kwargs)
            current_ssh_process.wait()
        except Exception as e:
            print("SSH Tunnel error:", e)
        
        if not stop_event.is_set():
            print("SSH Tunnel closed. Restarting in 5 seconds...")
            # Use event wait instead of sleep to allow quick interruption
            stop_event.wait(5)

def run_uvicorn():
    global server
    config = uvicorn.Config(app, host="0.0.0.0", port=8001, log_config=None)
    server = uvicorn.Server(config)
    server.run()

def on_quit(icon_item, item):
    global current_ssh_process, server, tray_icon
    print("Quitting agent...")
    stop_event.set()
    if current_ssh_process:
        try:
            current_ssh_process.terminate()
            current_ssh_process.kill()
        except:
            pass
    if server:
        server.should_exit = True
    if tray_icon:
        tray_icon.stop()
    # Force exit to ensure no hanging threads
    os._exit(0)

def create_image(width, height, color1, color2):
    import pystray
    from PIL import Image, ImageDraw
    image = Image.new('RGB', (width, height), color1)
    dc = ImageDraw.Draw(image)
    dc.rectangle((width // 2, 0, width, height // 2), fill=color2)
    dc.rectangle((0, height // 2, width // 2, height), fill=color2)
    return image

if __name__ == "__main__":
    import sys, os
    import pystray
    
    if getattr(sys, 'frozen', False):
        app_path = os.path.dirname(sys.executable)
    else:
        app_path = os.path.dirname(os.path.abspath(__file__))
        
    log_path = os.path.join(app_path, "agent.log")
    log_file = open(log_path, 'a', buffering=1)
    sys.stdout = log_file
    sys.stderr = log_file
    
    tunnel_thread = threading.Thread(target=maintain_ssh_tunnel, daemon=True)
    tunnel_thread.start()

    server_thread = threading.Thread(target=run_uvicorn, daemon=True)
    server_thread.start()
    
    try:
        icon_image = create_image(64, 64, '#0078D7', 'white')
        menu = pystray.Menu(
            pystray.MenuItem('Web Portal Access Agent', lambda: None, enabled=False),
            pystray.MenuItem('Status: Running', lambda: None, enabled=False),
            pystray.MenuItem('Quit', on_quit)
        )
        tray_icon = pystray.Icon("WebPortalAgent", icon_image, "Web Portal Access Agent", menu)
        tray_icon.run()
    except Exception as e:
        print("Tray icon error:", e)
        # Fallback if tray fails
        stop_event.wait()
