import urllib.request
import urllib.error
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request('https://88.210.29.61:38181/api/v2.0/system/info')
req.add_header('Authorization', 'Bearer 1-OxImUZXxUUxutOSGv6HGCZMwI5vnQWDx97V58msB47NG9bWungrIe9U3GsofKGOf')

try:
    resp = urllib.request.urlopen(req, context=ctx).read().decode()
    print("Sys Info:", resp[:500])
except Exception as e:
    print("Error:", e)
