import paramiko
import sys

host = '138.124.77.191'
user = 'root'
password = 'aM6jD2xK4zhO'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect(hostname=host, username=user, password=password, timeout=10)
except Exception as e:
    print("Failed to connect:", e)
    sys.exit(1)

commands = [
    # Remove broken repos
    "rm -f /etc/apt/sources.list.d/xanmod*.list",
    
    # Install dependencies (ignore apt update error if any)
    "apt update || true",
    "apt install -y wireguard qrencode iptables",
    
    # Create wireguard dir if it doesn't exist
    "mkdir -p /etc/wireguard",
    "chmod 700 /etc/wireguard",
    
    # Enable routing
    "echo 'net.ipv4.ip_forward=1' > /etc/sysctl.d/99-wireguard.conf",
    "sysctl -p /etc/sysctl.d/99-wireguard.conf || true",
    
    # Generate Server Keys
    "wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key",
    
    # Generate Client (Windows) Keys
    "wg genkey | tee /etc/wireguard/win11_private.key | wg pubkey > /etc/wireguard/win11_public.key",
    
    # Create Server Config using bash EOF securely
    "SERVER_PRIV=$(cat /etc/wireguard/server_private.key); WIN11_PUB=$(cat /etc/wireguard/win11_public.key); cat << EOF > /etc/wireguard/wg0.conf\n[Interface]\nAddress = 10.7.0.1/24\nListenPort = 51820\nPrivateKey = $SERVER_PRIV\nPostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE\nPostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE\n\n[Peer]\nPublicKey = $WIN11_PUB\nAllowedIPs = 10.7.0.2/32\nEOF",
    
    # Start server
    "systemctl enable wg-quick@wg0",
    "systemctl restart wg-quick@wg0",
    
    # Create Client Config
    "WIN11_PRIV=$(cat /etc/wireguard/win11_private.key); SERVER_PUB=$(cat /etc/wireguard/server_public.key); cat << EOF > /root/win11.conf\n[Interface]\nPrivateKey = $WIN11_PRIV\nAddress = 10.7.0.2/24\nDNS = 1.1.1.1, 8.8.8.8\n\n[Peer]\nPublicKey = $SERVER_PUB\nEndpoint = 138.124.77.191:51820\nAllowedIPs = 10.7.0.0/24\nPersistentKeepalive = 25\nEOF"
]

print("Executing manual setup...")
for cmd in commands:
    stdin, stdout, stderr = client.exec_command(cmd)
    exit_status = stdout.channel.recv_exit_status()
    if exit_status != 0:
        print(f"Warning on {cmd[:20]}... Exit {exit_status}")
        print("ERR:", stderr.read().decode())

print("\n=== SETUP COMPLETE ===")
print("Here is your Windows 11 WireGuard Config:")
stdin, stdout, stderr = client.exec_command("cat /root/win11.conf")
print(stdout.read().decode('utf-8'))

client.close()
