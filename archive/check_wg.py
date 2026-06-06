import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('138.124.77.191', username='root', password='aM6jD2xK4zhO')

commands = [
    "wg show wg0",
    "ip route",
    "iptables -L -n -v",
    "ufw status"
]

for cmd in commands:
    print(f"\n--- {cmd} ---")
    stdin, stdout, stderr = client.exec_command(cmd)
    print("OUT:", stdout.read().decode('utf-8', errors='ignore'))
    print("ERR:", stderr.read().decode('utf-8', errors='ignore'))

client.close()
