import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = 'http://88.210.29.61:38181/api/v2.0/system/info'
req = urllib.request.Request(url, method='GET')
req.add_header('Authorization', 'Bearer 1-OxImUZXxUUxutOSGv6HGCZMwI5vnQWDx97V58msB47NG9bWungrIe9U3GsofKGOf')

try:
    with urllib.request.urlopen(req, context=ctx, timeout=5) as res:
        print(json.loads(res.read().decode()))
except Exception as e:
    print('ERROR:', e)
