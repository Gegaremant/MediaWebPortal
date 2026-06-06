import urllib.request
import urllib.error
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request('https://88.210.29.61:38181/api/v2.0/core/ping')
req.add_header('Authorization', 'Bearer 1-OxImUZXxUUxutOSGv6HGCZMwI5vnQWDx97V58msB47NG9bWungrIe9U3GsofKGOf')
try:
    print("HTTPS ping:", urllib.request.urlopen(req, context=ctx).read().decode())
except urllib.error.URLError as e:
    print("HTTPS error:", e)

req2 = urllib.request.Request('http://192.168.9.223/api/v2.0/core/ping')
req2.add_header('Authorization', 'Bearer 1-OxImUZXxUUxutOSGv6HGCZMwI5vnQWDx97V58msB47NG9bWungrIe9U3GsofKGOf')
try:
    print("HTTP internal ping:", urllib.request.urlopen(req2, timeout=5).read().decode())
except urllib.error.URLError as e:
    print("HTTP internal error:", e)
