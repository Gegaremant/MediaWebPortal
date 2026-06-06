import paramiko
import os

host = '138.124.77.191'
user = 'root'
password = 'aM6jD2xK4zhO'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password)

print("--- Installing PostgreSQL & Python ---")
cmd = "apt update && apt install -y postgresql postgresql-contrib python3 python3-pip python3-venv"
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='ignore').encode('ascii', errors='ignore').decode('ascii'))

print("--- Uploading files ---")
sftp = client.open_sftp()
local_backend_dir = r"C:\Projects\web_portal\backend"
files = ["requirements.txt", "database.py", "models.py", "auth.py", "worker.py", "main.py", "__init__.py"]

for f in files:
    local_path = os.path.join(local_backend_dir, f)
    remote_path = f"/opt/webportal/backend/{f}"
    sftp.put(local_path, remote_path)
    print(f"Uploaded {f}")
sftp.close()

print("--- Setting up Python virtual environment & installing requirements ---")
setup_cmd = """
cd /opt/webportal
./venv/bin/pip install -r backend/requirements.txt
"""
stdin, stdout, stderr = client.exec_command(setup_cmd)
print(stdout.read().decode('utf-8', errors='ignore').encode('ascii', errors='ignore').decode('ascii'))

print("--- Creating worker systemd service ---")
worker_service_content = """
[Unit]
Description=FastAPI Web Portal Worker
After=network.target

[Service]
User=root
WorkingDirectory=/opt/webportal
ExecStart=/opt/webportal/venv/bin/python -m backend.worker
Environment="ARCHIVE_PATH=/mnt/archive"
Restart=always

[Install]
WantedBy=multi-user.target
"""
client.exec_command(f"cat << 'EOF' > /etc/systemd/system/webportal-worker.service\n{worker_service_content}\nEOF")

client.exec_command("systemctl daemon-reload")
client.exec_command("systemctl restart webportal")
client.exec_command("systemctl enable webportal-worker")
client.exec_command("systemctl restart webportal-worker")

print("Backend deployment complete!")
client.close()
