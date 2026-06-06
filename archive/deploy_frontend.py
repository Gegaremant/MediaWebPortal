import paramiko
import os

host = '138.124.77.191'
user = 'root'
password = 'aM6jD2xK4zhO'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password)

def run_cmd(cmd):
    print(f"\n--- {cmd} ---")
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='ignore').encode('ascii', errors='ignore').decode('ascii')
    err = stderr.read().decode('utf-8', errors='ignore').encode('ascii', errors='ignore').decode('ascii')
    if out: print("OUT:", out.strip()[:1000])
    if err: print("ERR:", err.strip()[:1000])
    return out

print("Setting up React app structure...")
setup_cmd = """
cd /opt/webportal
if [ ! -d "frontend" ]; then
    npx -y create-vite@latest frontend --template react
fi
cd frontend
npm install
npm install react-icons
"""
run_cmd(setup_cmd)

print("Uploading Frontend source files...")
sftp = client.open_sftp()
local_src = r"C:\Projects\web_portal\frontend_src"
files = ["main.jsx", "App.jsx", "index.css"]
for f in files:
    local_path = os.path.join(local_src, f)
    remote_path = f"/opt/webportal/frontend/src/{f}"
    sftp.put(local_path, remote_path)
    print(f"Uploaded {f} to src")

print("Uploading updated Backend...")
sftp.put(r"C:\Projects\web_portal\backend\main.py", "/opt/webportal/backend/main.py")
sftp.close()

print("Building Frontend...")
client.exec_command('cd /opt/webportal/frontend && npm install recharts && npm run build')

print("Restarting Web Portal Service...")
run_cmd("systemctl restart webportal")
run_cmd("systemctl is-active webportal")

client.close()
print("Frontend deployment complete! Go to http://138.124.77.191:8000")
