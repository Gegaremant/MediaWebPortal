$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$startupFolder = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$startupExe = Join-Path $startupFolder 'WebPortalAccessAgent.exe'

Write-Host '1. Copying agent to startup folder...'
# Copy from the current folder (Z:\) instead of downloading
$sourceExe = Join-Path $PSScriptRoot 'dist\WebPortalAccessAgent.exe'
if (Test-Path $sourceExe) {
    Copy-Item -Path $sourceExe -Destination $startupExe -Force
    Write-Host 'Agent copied successfully from disk!'
} else {
    Write-Host "Agent not found at $sourceExe. Attempting to download..."
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
    Invoke-WebRequest -UseBasicParsing -Uri 'https://portal.gegaremant.ru/windows_agent.exe' -OutFile $startupExe
    Write-Host 'Downloaded!'
}

$sshKeyPath = "$env:USERPROFILE\.ssh\id_rsa"
if (-not (Test-Path $sshKeyPath)) {
    Write-Host '2. Creating SSH key...'
    ssh-keygen -t rsa -b 4096 -N "" -f "$env:USERPROFILE\.ssh\id_rsa"
    Write-Host 'Done!'
} else {
    Write-Host '2. SSH key exists.'
}

Write-Host '3. Adding key to server (needs root@138.124.77.191 password)...'
cat "$env:USERPROFILE\.ssh\id_rsa.pub" | ssh root@138.124.77.191 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys'

Write-Host '4. Cleaning up old processes...'
Stop-Process -Name 'windows_agent' -Force -ErrorAction SilentlyContinue

Write-Host '5. Starting agent in background...'
Start-Process -FilePath $startupExe -WindowStyle Hidden
Write-Host 'Installation completed!'
Start-Sleep -Seconds 3
