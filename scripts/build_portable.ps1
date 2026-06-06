$ErrorActionPreference = "Stop"
$toolsDir = "C:\AndroidLocal"
if (!(Test-Path $toolsDir)) { New-Item -ItemType Directory -Force -Path $toolsDir }

Write-Host "Downloading OpenJDK 17 Portable..."
$jdkZip = "$toolsDir\jdk.zip"
if (!(Test-Path "$toolsDir\jdk-17.0.2\bin\java.exe")) {
    Invoke-WebRequest -Uri "https://download.java.net/java/GA/jdk17.0.2/dfd4a8d0985749f896bed50d7138ee7f/8/GPL/openjdk-17.0.2_windows-x64_bin.zip" -OutFile $jdkZip
    Expand-Archive -Path $jdkZip -DestinationPath $toolsDir -Force
}

Write-Host "Downloading Node.js Portable..."
$nodeZip = "$toolsDir\node.zip"
if (!(Test-Path "$toolsDir\node-v20.14.0-win-x64\node.exe")) {
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.14.0/node-v20.14.0-win-x64.zip" -OutFile $nodeZip
    Expand-Archive -Path $nodeZip -DestinationPath $toolsDir -Force
}

Write-Host "Downloading Android SDK cmdline-tools..."
$androidHome = "$toolsDir\sdk"
if (!(Test-Path $androidHome)) { New-Item -ItemType Directory -Force -Path $androidHome }
$cmdlineToolsZip = "$androidHome\cmdline-tools.zip"
if (!(Test-Path "$androidHome\cmdline-tools\latest\bin\sdkmanager.bat")) {
    Invoke-WebRequest -Uri "https://dl.google.com/android/repository/commandlinetools-win-11479070_latest.zip" -OutFile $cmdlineToolsZip
    Expand-Archive -Path $cmdlineToolsZip -DestinationPath "$androidHome\cmdline-tools" -Force
    Rename-Item -Path "$androidHome\cmdline-tools\cmdline-tools" -NewName "latest"
}

Write-Host "Setting Environment Variables..."
$env:JAVA_HOME = "$toolsDir\jdk-17.0.2"
$env:ANDROID_HOME = $androidHome
$env:PATH = "$env:JAVA_HOME\bin;$toolsDir\node-v20.14.0-win-x64;$env:PATH"

Write-Host "Accepting SDK licenses..."
$sdkmanager = "$androidHome\cmdline-tools\latest\bin\sdkmanager.bat"
cmd.exe /c "yes | $sdkmanager --licenses"
cmd.exe /c "$sdkmanager `"platforms;android-35`" `"build-tools;34.0.0`" `"platform-tools`""

Write-Host "Fetching Android project..."
$projectDir = "C:\Projects\web_portal\android_app_local"
if (!(Test-Path $projectDir)) {
    scp -r -o StrictHostKeyChecking=no root@138.124.77.191:/opt/webportal/android_app $projectDir
}

Write-Host "Running npm install..."
Set-Location $projectDir
cmd.exe /c "npm install --legacy-peer-deps"

Write-Host "Patching react-native-screens codegen bug..."
python -c "import re, os; f='node_modules/react-native-screens/src/fabric/ScreenNativeComponent.ts'; text=open(f).read() if os.path.exists(f) else ''; open(f, 'w').write(re.sub(r'accessibilityContainerViewIsModal\?: boolean;', '// accessibilityContainerViewIsModal?: boolean;', text)) if text else None"

Write-Host "Building APK..."
Set-Location "$projectDir\android"
cmd.exe /c "gradlew.bat assembleRelease"

Write-Host "APK Built Successfully!"
