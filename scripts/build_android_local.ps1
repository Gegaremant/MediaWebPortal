$ErrorActionPreference = "Stop"

Write-Host "Installing OpenJDK 17..."
winget install -e --id Microsoft.OpenJDK.17 --scope user --accept-package-agreements --accept-source-agreements --silent

Write-Host "Installing Node.js..."
winget install -e --id OpenJS.NodeJS --scope user --accept-package-agreements --accept-source-agreements --silent

Write-Host "Setting up Android SDK..."
$androidHome = "C:\Android"
if (!(Test-Path $androidHome)) {
    New-Item -ItemType Directory -Force -Path $androidHome
}

$cmdlineToolsZip = "$androidHome\cmdline-tools.zip"
if (!(Test-Path "$androidHome\cmdline-tools\latest\bin\sdkmanager.bat")) {
    Write-Host "Downloading commandlinetools..."
    Invoke-WebRequest -Uri "https://dl.google.com/android/repository/commandlinetools-win-11479070_latest.zip" -OutFile $cmdlineToolsZip
    
    Write-Host "Extracting commandlinetools..."
    Expand-Archive -Path $cmdlineToolsZip -DestinationPath "$androidHome\cmdline-tools" -Force
    Rename-Item -Path "$androidHome\cmdline-tools\cmdline-tools" -NewName "latest"
}

Write-Host "Setting ANDROID_HOME..."
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", $androidHome, [System.EnvironmentVariableTarget]::User)
$env:ANDROID_HOME = $androidHome

Write-Host "Accepting licenses and installing SDK packages..."
$sdkmanager = "$androidHome\cmdline-tools\latest\bin\sdkmanager.bat"
cmd.exe /c "yes | $sdkmanager --licenses"
cmd.exe /c "$sdkmanager `"platforms;android-34`" `"build-tools;34.0.0`" `"platform-tools`""

Write-Host "Fetching Android project from server..."
$projectDir = "C:\Projects\web_portal\android_app_local"
if (!(Test-Path $projectDir)) {
    scp -r -o StrictHostKeyChecking=no root@138.124.77.191:/opt/webportal/android_app $projectDir
}

Write-Host "Running npm install..."
Set-Location $projectDir
cmd.exe /c "npm install"

Write-Host "Building APK..."
Set-Location "$projectDir\android"
cmd.exe /c "gradlew.bat assembleRelease"

Write-Host "Done!"
