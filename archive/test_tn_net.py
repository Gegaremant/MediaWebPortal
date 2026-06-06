import urllib.request
import urllib.error
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def get(path):
    req = urllib.request.Request(f'https://88.210.29.61:38181{path}')
    req.add_header('Authorization', 'Bearer 1-OxImUZXxUUxutOSGv6HGCZMwI5vnQWDx97V58msB47NG9bWungrIe9U3GsofKGOf')
    try:
        return json.loads(urllib.request.urlopen(req, context=ctx).read().decode())
    except Exception as e:
        return str(e)

print("Interfaces:", get('/api/v2.0/interface')[:2])
print("Pools:", str(get('/api/v2.0/pool'))[:500])
