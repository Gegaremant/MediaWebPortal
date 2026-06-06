import paramiko
import os

host = '138.124.77.191'
user = 'root'
password = 'aM6jD2xK4zhO'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname=host, username=user, password=password, timeout=10)
sftp = client.open_sftp()
sftp.put('C:/Projects/web_portal/dist/windows_agent.exe', '/opt/webportal/frontend/dist/windows_agent.exe')
sftp.close()
client.close()
print("Uploaded!")
