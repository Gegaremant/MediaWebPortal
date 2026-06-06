import paramiko
import sys

host = '138.124.77.191'
user = 'root'
password = 'aM6jD2xK4zhO'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

print("Connecting to Debian...")
try:
    client.connect(hostname=host, username=user, password=password, timeout=10)
    print("Connected!")
except Exception as e:
    print("Failed to connect:", e)
    sys.exit(1)

commands = [
    "useradd -m -s /bin/bash sokolovanv || true",
    "echo 'sokolovanv:SokolovVpn!2026' | chpasswd",
    "usermod -aG sudo sokolovanv",
    "apt update && apt install -y curl ufw",
    "curl -O https://raw.githubusercontent.com/angristan/wireguard-install/master/wireguard-install.sh",
    "chmod +x wireguard-install.sh",
    "AUTO_INSTALL=y bash wireguard-install.sh"
]

for cmd in commands:
    print(f"\n--- Running: {cmd} ---")
    stdin, stdout, stderr = client.exec_command(cmd)
    
    # Wait for the command to finish
    exit_status = stdout.channel.recv_exit_status()
    
    out = stdout.read().decode('utf-8', errors='ignore')
    err = stderr.read().decode('utf-8', errors='ignore')
    
    if out: print("OUT:\n" + out.strip())
    if err: print("ERR:\n" + err.strip())
    print(f"Exit status: {exit_status}")

# Try to add client 'win11' if not automatically created
print("\n--- Creating win11 client ---")
stdin, stdout, stderr = client.exec_command("MENU_OPTION=1 CLIENT_NAME=win11 PASS=1 bash wireguard-install.sh")
exit_status = stdout.channel.recv_exit_status()
print(stdout.read().decode('utf-8', errors='ignore'))
print(stderr.read().decode('utf-8', errors='ignore'))

# Read the config
print("\n--- WIREGUARD CONFIG ---")
stdin, stdout, stderr = client.exec_command("cat /root/wg0-client-win11.conf || cat /root/win11.conf || ls /root/*.conf")
out = stdout.read().decode('utf-8', errors='ignore')
print(out)

client.close()
print("Done.")
