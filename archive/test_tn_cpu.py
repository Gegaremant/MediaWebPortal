import urllib.request
import urllib.error
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request('https://88.210.29.61:38181/api/v2.0/reporting/get_data', method='POST')
req.add_header('Authorization', 'Bearer 1-OxImUZXxUUxutOSGv6HGCZMwI5vnQWDx97V58msB47NG9bWungrIe9U3GsofKGOf')
req.add_header('Content-Type', 'application/json')
payload = json.dumps([{"name": "cpu"}]).encode('utf-8')

try:
    resp = urllib.request.urlopen(req, data=payload, context=ctx).read().decode()
    print("CPU Data:", resp[:500]) # only first 500 chars
except Exception as e:
    print("Error:", e)
