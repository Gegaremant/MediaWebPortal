import re

with open('C:/Projects/web_portal/backend/main.py', 'r', encoding='utf-8') as f:
    code = f.read()

indexer_old = """            # Only scan web_portal to avoid system files
            scan_path = os.path.join(ARCHIVE_PATH, "web_portal")
            if os.path.exists(scan_path):
                for root, dirs, files in os.walk(scan_path):
                    for f in files:"""

indexer_new = """            # Only scan Auto_sorted and Approved to avoid system files
            scan_paths = [
                os.path.join(ARCHIVE_PATH, "Web_portal", "Auto_sorted"),
                os.path.join(ARCHIVE_PATH, "Web_portal", "Approved")
            ]
            for scan_path in scan_paths:
                if os.path.exists(scan_path):
                    for root, dirs, files in os.walk(scan_path):
                        for f in files:"""
code = code.replace(indexer_old, indexer_new)

with open('C:/Projects/web_portal/backend/main.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Backend updated with restricted indexer paths.")
