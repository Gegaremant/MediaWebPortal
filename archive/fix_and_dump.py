import paramiko
import time

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('138.124.77.191', username='root', password='aM6jD2xK4zhO')

# Fix iptables rule to ens3
client.exec_command("sed -i 's/eth0/ens3/g' /etc/wireguard/wg0.conf")
client.exec_command("systemctl restart wg-quick@wg0")
time.sleep(2)

print("\n--- ip_forward ---")
stdin, stdout, stderr = client.exec_command("cat /proc/sys/net/ipv4/ip_forward")
print(stdout.read().decode().strip())

print("\n--- tcpdump ---")
stdin, stdout, stderr = client.exec_command("timeout 15 tcpdump -i wg0 -n")
print(stdout.read().decode())
print("ERR:", stderr.read().decode())

client.close()
