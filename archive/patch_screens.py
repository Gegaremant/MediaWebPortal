import re
import os

path = '/opt/webportal/android_app/node_modules/react-native-screens/src/fabric/ScreenNativeComponent.ts'
if os.path.exists(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = re.sub(r'accessibilityContainerViewIsModal\?: boolean;', '// accessibilityContainerViewIsModal?: boolean;', content)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched!")
else:
    print("File not found")
