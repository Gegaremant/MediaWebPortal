[Setup]
AppName=Web Portal Access Agent
AppVersion=1.0.0.0
Publisher=Web Portal
DefaultDirName={autopf}\Web Portal Access Agent
DefaultGroupName=Web Portal Access Agent
UninstallDisplayIcon={app}\WebPortalAccessAgent.exe
Compression=lzma2
SolidCompression=yes
OutputDir=C:\Projects\web_portal\dist
OutputBaseFilename=WebPortalAccessAgent_Setup
PrivilegesRequired=admin
SetupIconFile=C:\Projects\web_portal\icon.ico

[Files]
Source: "C:\Projects\web_portal\dist\WebPortalAccessAgent.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Web Portal Access Agent"; Filename: "{app}\WebPortalAccessAgent.exe"
Name: "{group}\Uninstall Web Portal Access Agent"; Filename: "{uninstallexe}"
Name: "{commonstartup}\Web Portal Access Agent"; Filename: "{app}\WebPortalAccessAgent.exe"

[Run]
Filename: "{app}\WebPortalAccessAgent.exe"; Description: "Launch Web Portal Access Agent"; Flags: nowait postinstall

[UninstallRun]
Filename: "{cmd}"; Parameters: "/C taskkill /F /IM WebPortalAccessAgent.exe /T"; Flags: runhidden
