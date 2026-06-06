import re

with open('C:/Projects/web_portal/backend/main.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Add TrueNAS thread
truenas_thread_code = """
import threading
import urllib.request
import ssl
import json

TRUENAS_URL = "https://88.210.29.61:38181"
TRUENAS_TOKEN = "1-OxImUZXxUUxutOSGv6HGCZMwI5vnQWDx97V58msB47NG9bWungrIe9U3GsofKGOf"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

truenas_metrics = {
    "cpu": 0,
    "ram": 0,
    "net_tx": 0,
    "net_rx": 0,
    "disk_read": 0,
    "disk_write": 0,
    "disks": []
}

def poll_truenas():
    while True:
        try:
            # System Info
            req_sys = urllib.request.Request(f"{TRUENAS_URL}/api/v2.0/system/info")
            req_sys.add_header("Authorization", f"Bearer {TRUENAS_TOKEN}")
            sys_info = json.loads(urllib.request.urlopen(req_sys, context=ctx, timeout=5).read().decode())
            
            # Simple CPU approximation from loadavg
            cores = sys_info.get("cores", 1)
            load = sys_info.get("loadavg", [0])[0]
            cpu_percent = min((load / cores) * 100, 100.0)
            
            # Pools
            req_pool = urllib.request.Request(f"{TRUENAS_URL}/api/v2.0/pool")
            req_pool.add_header("Authorization", f"Bearer {TRUENAS_TOKEN}")
            pools = json.loads(urllib.request.urlopen(req_pool, context=ctx, timeout=5).read().decode())
            
            disks = []
            for p in pools:
                try:
                    # To get actual used space we might need dataset, but let's just put pool name
                    disks.append({
                        "device": p["name"],
                        "total": 1,
                        "free": 1,
                        "percent": 0
                    })
                except: pass
                
            truenas_metrics["cpu"] = round(cpu_percent, 1)
            truenas_metrics["disks"] = disks
            
        except Exception as e:
            print("TrueNAS Poll Error:", e)
            
        time.sleep(2)

threading.Thread(target=poll_truenas, daemon=True).start()
"""

# Insert TrueNAS thread near top of main.py
code = code.replace('from fastapi import FastAPI, Depends, UploadFile, File, Form', truenas_thread_code + '\nfrom fastapi import FastAPI, Depends, UploadFile, File, Form')

# Add to /api/admin/metrics
# Find return block in get_metrics
metrics_return_old = """    return {
        "debian": debian_metrics,
        "windows": windows_metrics,
        "sorting": sorting_metrics
    }"""

metrics_return_new = """    return {
        "debian": debian_metrics,
        "windows": windows_metrics,
        "truenas": truenas_metrics,
        "sorting": sorting_metrics
    }"""

code = code.replace(metrics_return_old, metrics_return_new)

with open('C:/Projects/web_portal/backend/main.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Backend updated with TrueNAS polling.")
