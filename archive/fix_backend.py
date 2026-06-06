import re

filepath = '/opt/webportal/backend/main.py'
with open(filepath, 'r') as f:
    content = f.read()

# Fix "auto_sorted" check
content = content.replace('if "auto_sorted" not in target_path:', 'if "auto_sorted" not in target_path.lower():')

# Fix replacement to be case insensitive
content = content.replace('new_path_relative = req.path.replace("auto_sorted", "approved")', 
                          'new_path_relative = re.sub(r"auto_sorted", "Approved", req.path, flags=re.IGNORECASE)')

with open(filepath, 'w') as f:
    f.write(content)
