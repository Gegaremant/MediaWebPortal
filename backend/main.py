import os
import shutil
from pathlib import Path
from typing import List, Optional
import urllib.request
import json
import time
import psutil
import threading
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel
from . import models, database, auth

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Media Archive Web Portal")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ARCHIVE_PATH = os.getenv("ARCHIVE_PATH", "/mnt/archive")
AUTO_SORTED_PATH = os.path.join(ARCHIVE_PATH, "auto_sorted")
APPROVED_PATH = os.path.join(ARCHIVE_PATH, "approved")

# Ensure base dirs exist
try:
    os.makedirs(AUTO_SORTED_PATH, exist_ok=True)
    os.makedirs(APPROVED_PATH, exist_ok=True)
except OSError as e:
    print(f"Warning: Could not create directories. NAS might be down. Error: {e}")

# Initialize Default Settings
def init_settings():
    db = database.SessionLocal()
    defaults = {
        "site_title": "Медиа Архив",
        "accent_color": "#3b82f6",
        "bg_color": "#0f172a",
        "bg_image": "",
        "card_opacity": "0.2"
    }
    for key, value in defaults.items():
        if not db.query(models.Setting).filter(models.Setting.key == key).first():
            db.add(models.Setting(key=key, value=value))
    db.commit()
    db.close()

init_settings()

class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    is_approved: bool
    allowed_tabs: Optional[str] = "files,photos,videos"

# --- AUTH ENDPOINTS ---

@app.post("/api/auth/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # First user becomes admin and is auto-approved
    is_first = db.query(models.User).count() == 0
    role = "admin" if is_first else "user"
    is_approved = True if is_first else False
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(
        username=user.username, 
        hashed_password=hashed_password,
        role=role,
        is_approved=is_approved
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_approved:
         raise HTTPException(status_code=403, detail="Account pending admin approval")
         
    access_token_expires = auth.timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "role": user.role, "allowed_tabs": user.allowed_tabs}

@app.get("/api/auth/me", response_model=UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_active_user)):
    return current_user

# --- ADMIN ENDPOINTS ---

@app.get("/api/admin/users", response_model=List[UserResponse])
def get_all_users(current_user: models.User = Depends(auth.get_current_admin_user), db: Session = Depends(database.get_db)):
    users = db.query(models.User).all()
    return users

class UserPermissionsUpdate(BaseModel):
    allowed_tabs: str

@app.post("/api/admin/users/{user_id}/permissions")
def update_user_permissions(user_id: int, permissions: UserPermissionsUpdate, current_user: models.User = Depends(auth.get_current_admin_user), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.allowed_tabs = permissions.allowed_tabs
    db.commit()
    return {"success": True}

# --- METRICS ENDPOINT ---

last_net_io = psutil.net_io_counters()
last_disk_io = psutil.disk_io_counters()
last_time = time.time()

metrics_cache = {}

@app.get("/api/admin/metrics")
def get_metrics(current_user: models.User = Depends(auth.get_current_admin_user)):
    global last_net_io, last_time, last_disk_io
    
    current_time = time.time()
    current_net_io = psutil.net_io_counters()
    current_disk_io = psutil.disk_io_counters()
    time_diff = current_time - last_time
    
    bytes_sent_per_sec = (current_net_io.bytes_sent - last_net_io.bytes_sent) / time_diff if time_diff > 0 else 0
    bytes_recv_per_sec = (current_net_io.bytes_recv - last_net_io.bytes_recv) / time_diff if time_diff > 0 else 0
    
    disk_read_per_sec = (current_disk_io.read_bytes - last_disk_io.read_bytes) / time_diff if time_diff > 0 else 0
    disk_write_per_sec = (current_disk_io.write_bytes - last_disk_io.write_bytes) / time_diff if time_diff > 0 else 0
    
    last_net_io = current_net_io
    last_disk_io = current_disk_io
    last_time = current_time
    # Debian Disks
    disks = []
    for part in psutil.disk_partitions(all=False):
        if part.fstype != '':
            try:
                usage = psutil.disk_usage(part.mountpoint)
                disks.append({
                    "device": part.device,
                    "mountpoint": part.mountpoint,
                    "percent": usage.percent,
                    "total": usage.total,
                    "free": usage.free
                })
            except:
                pass

    # Calculate network and disk speed
    net_io = psutil.net_io_counters()
    disk_io = psutil.disk_io_counters()
    current_time = time.time()
    
    net_tx = 0
    net_rx = 0
    disk_read = 0
    disk_write = 0
    if "last_time" in metrics_cache:
        dt = current_time - metrics_cache["last_time"]
        if dt > 0:
            net_tx = (net_io.bytes_sent - metrics_cache["net_tx"]) / dt
            net_rx = (net_io.bytes_recv - metrics_cache["net_rx"]) / dt
            disk_read = (disk_io.read_bytes - metrics_cache.get("disk_read", disk_io.read_bytes)) / dt
            disk_write = (disk_io.write_bytes - metrics_cache.get("disk_write", disk_io.write_bytes)) / dt
            
    metrics_cache["net_tx"] = net_io.bytes_sent
    metrics_cache["net_rx"] = net_io.bytes_recv
    metrics_cache["disk_read"] = disk_io.read_bytes
    metrics_cache["disk_write"] = disk_io.write_bytes
    metrics_cache["last_time"] = current_time
    
    debian_metrics = {
        "cpu": psutil.cpu_percent(interval=0.1),
        "ram": psutil.virtual_memory().percent,
        "net_tx": net_tx,
        "net_rx": net_rx,
        "disk_read": disk_read,
        "disk_write": disk_write,
        "disks": disks,
        "boot_time": psutil.boot_time()
    }
    
    # Windows Metrics (from agent)
    windows_metrics = None
    try:
        req = urllib.request.Request("http://127.0.0.1:8001/metrics", method="GET")
        with urllib.request.urlopen(req, timeout=2) as response:
            windows_metrics = json.loads(response.read().decode())
    except Exception as e:
        pass
        
    # Sorting Metrics
    sorting_metrics = {}
    metrics_file = os.path.join(os.path.dirname(__file__), "sorting_metrics.json")
    if os.path.exists(metrics_file):
        try:
            with open(metrics_file, "r") as f:
                sorting_metrics = json.load(f)
        except:
            pass

    # TrueNAS metrics (from cache or windows agent)
    truenas_metrics = None
    if windows_metrics and windows_metrics.get("truenas") and (windows_metrics["truenas"].get("cpu", 0) > 0 or len(windows_metrics["truenas"].get("disks", [])) > 0):
        truenas_metrics = windows_metrics["truenas"]
    else:
        truenas_metrics = metrics_cache.get("truenas", None)
        
    if not truenas_metrics:
        truenas_metrics = {
            "cpu": 0, "ram": 0, "net_tx": 0, "net_rx": 0, "disk_read": 0, "disk_write": 0, "disks": []
        }

    return {
        "debian": debian_metrics,
        "windows": windows_metrics,
        "truenas": truenas_metrics,
        "sorting": sorting_metrics
    }

# TrueNAS polling thread
def poll_truenas_metrics():
    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    truenas_ip = None
    truenas_token = None
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if line.startswith("truenas_ip_ex"):
                    truenas_ip = line.split("=", 1)[1].strip()
                elif line.startswith("truenas_api"):
                    truenas_token = line.split("=", 1)[1].strip()
                    
    while True:
        if truenas_ip and truenas_token:
            url = f"https://{truenas_ip}/api/v2.0/reporting/get_data" if "://" not in truenas_ip else f"{truenas_ip}/api/v2.0/reporting/get_data"
            if not url.startswith("http"): url = "https://" + url
            req = urllib.request.Request(url, method="POST")
            req.add_header("Authorization", f"Bearer {truenas_token}")
            req.add_header("Content-Type", "application/json")
            data = json.dumps({"graphs": [{"name": "cpu"}, {"name": "memory"}], "reporting_query": {"unit": "HOURLY"}}).encode()
            
            try:
                # Dummy implementation assuming generic failure, falling back to basic info
                # In reality, TrueNAS API uses specific endpoints, we use system/info for now if reporting fails
                url_info = url.replace("reporting/get_data", "system/info")
                req_info = urllib.request.Request(url_info, method="GET")
                req_info.add_header("Authorization", f"Bearer {truenas_token}")
                with urllib.request.urlopen(req_info, context=ctx, timeout=3) as res:
                    info = json.loads(res.read().decode())
                    metrics_cache["truenas"] = {
                        "cpu": info.get("loadavg", [0])[0] * 10, # rough estimate
                        "ram": info.get("physmem", 0) / 1000000000, # dummy value just to show something
                        "net_tx": 0, "net_rx": 0, "disk_read": 0, "disk_write": 0,
                        "disks": [{"device": "pool", "mountpoint": "/mnt/pool", "percent": 50, "total": 100000, "free": 50000}]
                    }
            except Exception as e:
                metrics_cache["truenas"] = {"cpu": 0, "ram": 0, "net_tx": 0, "net_rx": 0, "disk_read": 0, "disk_write": 0, "disks": []}
            
            try:
                metrics_file = os.path.join(os.path.dirname(__file__), "truenas_metrics.json")
                with open(metrics_file, "w") as f:
                    json.dump(metrics_cache.get("truenas", {}), f)
            except:
                pass
        time.sleep(5)

threading.Thread(target=poll_truenas_metrics, daemon=True).start()


# --- TASK MANAGER ENDPOINTS ---

@app.get("/api/admin/debian/processes")
def get_debian_processes(current_user: models.User = Depends(auth.get_current_admin_user)):
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

@app.post("/api/admin/debian/kill/{pid}")
def kill_debian_process(pid: int, current_user: models.User = Depends(auth.get_current_admin_user)):
    try:
        p = psutil.Process(pid)
        p.terminate()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/admin/debian/reboot")
def reboot_debian(current_user: models.User = Depends(auth.get_current_admin_user)):
    os.system("sudo reboot")
    return {"success": True}

@app.get("/api/admin/windows/processes")
def get_windows_processes(current_user: models.User = Depends(auth.get_current_admin_user)):
    try:
        req = urllib.request.Request("http://127.0.0.1:8001/processes", method="GET")
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        return []

@app.post("/api/admin/windows/kill/{pid}")
def kill_windows_process(pid: int, current_user: models.User = Depends(auth.get_current_admin_user)):
    try:
        req = urllib.request.Request(f"http://127.0.0.1:8001/kill/{pid}", method="POST")
        with urllib.request.urlopen(req, timeout=5) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/admin/windows/reboot")
def reboot_windows(current_user: models.User = Depends(auth.get_current_admin_user)):
    try:
        req = urllib.request.Request("http://127.0.0.1:8001/reboot", method="POST")
        with urllib.request.urlopen(req, timeout=5) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/admin/users/{user_id}/approve")
def approve_user(user_id: int, current_user: models.User = Depends(auth.get_current_admin_user), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_approved = True
    db.commit()
    return {"message": "User approved"}

# --- MEDIA ENDPOINTS ---

@app.get("/api/files")
def list_files(path: str = "", current_user: models.User = Depends(auth.get_current_active_user)):
    if ".." in path or path.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid path")
        
    target_dir = os.path.join(ARCHIVE_PATH, path) if path else ARCHIVE_PATH
    
    if not os.path.exists(target_dir):
        raise HTTPException(status_code=404, detail="Directory not found")
        
    if not os.path.isdir(target_dir):
        raise HTTPException(status_code=400, detail="Path is not a directory")
        
    items = []
    try:
        for item in os.listdir(target_dir):
            item_path = os.path.join(target_dir, item)
            is_dir = os.path.isdir(item_path)
            items.append({
                "name": item,
                "is_dir": is_dir,
                "size": os.path.getsize(item_path) if not is_dir else None
            })
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
    return {"current_path": path, "items": items}

@app.get("/api/file/stream")
def stream_file(path: str, current_user: models.User = Depends(auth.get_current_active_user)):
    if ".." in path or path.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid path")
        
    target_path = os.path.join(ARCHIVE_PATH, path)
    if not os.path.exists(target_path) or os.path.isdir(target_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    # FileResponse handles HTTP Range requests perfectly for videos in FastAPI
    return FileResponse(target_path)

@app.get("/api/file/download")
def download_file(path: str, current_user: models.User = Depends(auth.get_current_active_user)):
    if ".." in path or path.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid path")
    target_path = os.path.join(ARCHIVE_PATH, path)
    if not os.path.exists(target_path) or os.path.isdir(target_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(target_path, headers={"Content-Disposition": f"attachment; filename={os.path.basename(target_path)}"})

class ApproveFileRequest(BaseModel):
    path: str

@app.post("/api/file/approve")
def approve_file(req: ApproveFileRequest, current_user: models.User = Depends(auth.get_current_admin_user)):
    # Path is something like "web_portal/auto_sorted/video/myvid.mp4"
    if ".." in req.path or req.path.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid path")
        
    target_path = os.path.join(ARCHIVE_PATH, req.path)
    if not os.path.exists(target_path) or not os.path.isfile(target_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    # Ensure it's inside auto_sorted
    if "auto_sorted" not in target_path:
        raise HTTPException(status_code=400, detail="Can only approve files in auto_sorted")
        
    # Replace auto_sorted with approved
    new_path_relative = req.path.replace("auto_sorted", "approved")
    new_full_path = os.path.join(ARCHIVE_PATH, new_path_relative)
    
    os.makedirs(os.path.dirname(new_full_path), exist_ok=True)
    shutil.move(target_path, new_full_path)
    
    return {"message": "File approved", "new_path": new_path_relative}

class DeleteFileRequest(BaseModel):
    path: str

@app.post("/api/file/delete")
def delete_file(req: DeleteFileRequest, current_user: models.User = Depends(auth.get_current_admin_user)):
    if ".." in req.path or req.path.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid path")
        
    target_path = os.path.join(ARCHIVE_PATH, req.path)
    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    if os.path.isdir(target_path):
        shutil.rmtree(target_path)
    else:
        os.remove(target_path)
    
    return {"message": "File or directory deleted"}

@app.post("/api/files/upload")
def upload_file(path: str = Form(...), file: UploadFile = File(...), current_user: models.User = Depends(auth.get_current_admin_user)):
    if ".." in path or path.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid path")
    target_path = os.path.join(ARCHIVE_PATH, path)
    if not os.path.exists(target_path):
        os.makedirs(target_path, exist_ok=True)
    file_path = os.path.join(target_path, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"message": "File uploaded successfully"}

class ShareFolderRequest(BaseModel):
    path: str

@app.post("/api/files/share")
def share_folder(req: ShareFolderRequest, current_user: models.User = Depends(auth.get_current_admin_user), db: Session = Depends(database.get_db)):
    if ".." in req.path or req.path.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid path")
    # Check if exists
    existing = db.query(models.SharedFolder).filter(models.SharedFolder.path == req.path).first()
    if existing:
        return {"token": existing.token}
    token = secrets.token_urlsafe(16)
    db.add(models.SharedFolder(path=req.path, token=token))
    db.commit()
    return {"token": token}

@app.get("/api/public/{token}")
def get_public_folder(token: str, db: Session = Depends(database.get_db)):
    shared = db.query(models.SharedFolder).filter(models.SharedFolder.token == token).first()
    if not shared:
        raise HTTPException(status_code=404, detail="Share not found")
    target_path = os.path.join(ARCHIVE_PATH, shared.path)
    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="Directory not found")
    
    files_list = []
    try:
        for item in os.listdir(target_path):
            item_path = os.path.join(target_path, item)
            files_list.append({
                "name": item,
                "is_dir": os.path.isdir(item_path),
                "size": os.path.getsize(item_path) if not os.path.isdir(item_path) else 0
            })
    except Exception as e:
        pass
    return files_list

@app.get("/api/public/{token}/download")
def download_public_file(token: str, file_name: str, db: Session = Depends(database.get_db)):
    shared = db.query(models.SharedFolder).filter(models.SharedFolder.token == token).first()
    if not shared:
        raise HTTPException(status_code=404, detail="Share not found")
    if ".." in file_name or "/" in file_name or "\\" in file_name:
        raise HTTPException(status_code=400, detail="Invalid file name")
    target_path = os.path.join(ARCHIVE_PATH, shared.path, file_name)
    if not os.path.exists(target_path) or not os.path.isfile(target_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(target_path, headers={"Content-Disposition": f"attachment; filename={file_name}"})

class SorterCommand(BaseModel):
    action: str
    delay_ms: int = None
    batch_size: int = None
    adaptive_mode: bool = None

@app.post("/api/admin/sorter")
def control_sorter(req: SorterCommand, current_user: models.User = Depends(auth.get_current_admin_user)):
    control_file = os.path.join(os.path.dirname(__file__), "sorter_control.json")
    state = {"status": "running", "delay_ms": 1000, "batch_size": 30, "adaptive_mode": True}
    if req.action == 'get':
        if os.path.exists(control_file):
            try:
                with open(control_file, "r") as f:
                    file_state = json.load(f)
                    state.update(file_state)
            except:
                pass
        return state
        
    if os.path.exists(control_file):
        try:
            with open(control_file, "r") as f:
                file_state = json.load(f)
                state.update(file_state)
        except:
            pass
    if req.action in ["pause", "running", "stopped"]:
        state["status"] = req.action
    if req.delay_ms is not None:
        state["delay_ms"] = req.delay_ms
    if req.batch_size is not None:
        state["batch_size"] = req.batch_size
    if req.adaptive_mode is not None:
        state["adaptive_mode"] = req.adaptive_mode
    with open(control_file, "w") as f:
        json.dump(state, f)
    return state

@app.get("/api/admin/duplicates")
def get_duplicates(current_user: models.User = Depends(auth.get_current_admin_user)):
    dupes_file = os.path.join(os.path.dirname(__file__), "duplicates.json")
    if os.path.exists(dupes_file):
        try:
            with open(dupes_file, "r") as f:
                return json.load(f)
        except:
            pass
    return []

class ResolveDuplicateRequest(BaseModel):
    id: str
    action: str # 'delete' or 'keep'

@app.post("/api/admin/duplicates/resolve")
def resolve_duplicate(req: ResolveDuplicateRequest, current_user: models.User = Depends(auth.get_current_admin_user)):
    dupes_file = os.path.join(os.path.dirname(__file__), "duplicates.json")
    dupes = []
    if os.path.exists(dupes_file):
        try:
            with open(dupes_file, "r") as f:
                dupes = json.load(f)
        except:
            pass
            
    target_dupe = next((d for d in dupes if d["id"] == req.id), None)
    if not target_dupe:
        raise HTTPException(status_code=404, detail="Duplicate not found")
        
    if req.action == 'delete':
        if os.path.exists(target_dupe["duplicate_path"]):
            os.remove(target_dupe["duplicate_path"])
    elif req.action == 'keep':
        base, ex = os.path.splitext(target_dupe["original_name"])
        counter = 1
        dst = os.path.join(target_dupe["original_dir"], f'{base}_{counter}{ex}')
        while os.path.exists(dst):
            counter += 1
            dst = os.path.join(target_dupe["original_dir"], f'{base}_{counter}{ex}')
        if os.path.exists(target_dupe["duplicate_path"]):
            shutil.move(target_dupe["duplicate_path"], dst)
            
    dupes = [d for d in dupes if d["id"] != req.id]
    with open(dupes_file, "w") as f:
        json.dump(dupes, f)
        
    return {"success": True}

# --- SETTINGS ENDPOINTS ---

@app.get("/api/settings")
def get_settings(db: Session = Depends(database.get_db)):
    settings = db.query(models.Setting).all()
    return {s.key: s.value for s in settings}

class SettingsUpdate(BaseModel):
    site_title: str
    accent_color: str
    bg_color: str
    bg_image: str
    card_opacity: str

@app.post("/api/admin/settings")
def update_settings(req: SettingsUpdate, current_user: models.User = Depends(auth.get_current_admin_user), db: Session = Depends(database.get_db)):
    updates = {
        "site_title": req.site_title,
        "accent_color": req.accent_color,
        "bg_color": req.bg_color,
        "bg_image": req.bg_image,
        "card_opacity": req.card_opacity
    }
    for key, value in updates.items():
        setting = db.query(models.Setting).filter(models.Setting.key == key).first()
        if setting:
            setting.value = value
        else:
            db.add(models.Setting(key=key, value=value))
    db.commit()
    return {"message": "Settings updated"}


media_cache = {
    "photos": [],
    "videos": []
}

def index_media():
    while True:
        try:
            photos_with_time = []
            videos_with_time = []
            
            def scan_dir_recursive(path):
                try:
                    for entry in os.scandir(path):
                        if entry.is_dir(follow_symlinks=False):
                            yield from scan_dir_recursive(entry.path)
                        elif entry.is_file(follow_symlinks=False):
                            yield entry
                except PermissionError:
                    pass
            
            # Only scan auto_sorted and approved to avoid system files
            scan_dirs = [
                os.path.join(ARCHIVE_PATH, "auto_sorted"),
                os.path.join(ARCHIVE_PATH, "approved")
            ]
            for scan_path in scan_dirs:
                if os.path.exists(scan_path):
                    for entry in scan_dir_recursive(scan_path):
                        ext = entry.name.lower().split('.')[-1]
                        rel_path = os.path.relpath(entry.path, ARCHIVE_PATH).replace("\\", "/")
                        try:
                            mtime = entry.stat().st_mtime
                        except:
                            mtime = 0
                            
                        if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic']:
                            photos_with_time.append((mtime, rel_path))
                        elif ext in ['mp4', 'avi', 'mkv', 'mov', 'webm']:
                            videos_with_time.append((mtime, rel_path))
            
            photos_with_time.sort(key=lambda x: x[0], reverse=True)
            videos_with_time.sort(key=lambda x: x[0], reverse=True)
            
            media_cache["photos"] = [p[1] for p in photos_with_time]
            media_cache["videos"] = [p[1] for p in videos_with_time]
            
        except Exception as e:
            print("Media Indexer Error:", e)
        time.sleep(300) # Every 5 mins

threading.Thread(target=index_media, daemon=True).start()

@app.get("/api/media/photos")
def get_photos(offset: int = 0, limit: int = 50, current_user: models.User = Depends(auth.get_current_active_user)):
    return {
        "total": len(media_cache["photos"]),
        "items": media_cache["photos"][offset:offset+limit]
    }

@app.get("/api/media/videos")
def get_videos(offset: int = 0, limit: int = 20, current_user: models.User = Depends(auth.get_current_active_user)):
    return {
        "total": len(media_cache["videos"]),
        "items": media_cache["videos"][offset:offset+limit]
    }

# Serve Frontend static files if they exist
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
