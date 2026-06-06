import paramiko
import os
import sys

host = '138.124.77.191'
user = 'root'
password = 'aM6jD2xK4zhO'

pubkey_path = os.path.expanduser('~/.ssh/id_rsa.pub')
if not os.path.exists(pubkey_path):
    print("Pubkey not found")
    sys.exit(1)

with open(pubkey_path, 'r') as f:
    pubkey = f.read().strip()

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname=host, username=user, password=password, timeout=10)

stdin, stdout, stderr = client.exec_command('mkdir -p ~/.ssh && echo "{}" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && chmod 700 ~/.ssh'.format(pubkey))
exit_status = stdout.channel.recv_exit_status()

if exit_status == 0:
    print("Key added successfully!")
else:
    print("Error:", stderr.read().decode())

client.close()
