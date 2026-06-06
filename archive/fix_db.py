import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('138.124.77.191', username='root', password='aM6jD2xK4zhO')

print("Dropping users table...")
stdin, stdout, stderr = client.exec_command('su - postgres -c \'psql -d webportal_db -c "DROP TABLE users CASCADE;"\'')
print("STDOUT:", stdout.read().decode())
print("STDERR:", stderr.read().decode())

print("Restarting webportal to recreate tables...")
client.exec_command('systemctl restart webportal')

client.close()
print("Done!")
