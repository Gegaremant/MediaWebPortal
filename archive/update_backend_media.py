import re

with open('C:/Projects/web_portal/backend/main.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Add Indexer and Endpoints
indexer_code = """
media_cache = {
    "photos": [],
    "videos": []
}

def index_media():
    while True:
        try:
            photos = []
            videos = []
            # Only scan web_portal to avoid system files
            scan_path = os.path.join(ARCHIVE_PATH, "web_portal")
            if os.path.exists(scan_path):
                for root, dirs, files in os.walk(scan_path):
                    for f in files:
                        ext = f.lower().split('.')[-1]
                        rel_path = os.path.relpath(os.path.join(root, f), ARCHIVE_PATH).replace("\\\\", "/")
                        if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic']:
                            photos.append(rel_path)
                        elif ext in ['mp4', 'avi', 'mkv', 'mov', 'webm']:
                            videos.append(rel_path)
            
            def get_mtime(p):
                try: return os.path.getmtime(os.path.join(ARCHIVE_PATH, p))
                except: return 0
                
            photos.sort(key=get_mtime, reverse=True)
            videos.sort(key=get_mtime, reverse=True)
            
            media_cache["photos"] = photos
            media_cache["videos"] = videos
            
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
"""

# Insert near the bottom, before static files mount
code = code.replace('# Serve Frontend static files if they exist', indexer_code + '\n# Serve Frontend static files if they exist')

with open('C:/Projects/web_portal/backend/main.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Backend updated with Media Indexer!")
