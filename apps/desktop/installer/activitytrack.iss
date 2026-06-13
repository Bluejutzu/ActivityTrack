; Inno Setup script for the ActivityTrack agent.
; Produces ActivityTrack-Setup-<version>.exe — a single distributable you can
; attach to a GitHub Release. Installs to Program Files, bundles a pinned
; node.exe + the built agent + koffi native binary, and registers a scheduled
; task that launches the agent at user logon (interactive session — required
; for idle detection to see input).
;
; Build with: iscc activitytrack.iss  (Inno Setup 6+ must be on PATH)
; The build:installer npm script stages ./staging before calling iscc.

#define AppName "ActivityTrack"
#define AppVersion "0.1.0"
#define AppPublisher "ActivityTrack"

[Setup]
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\{#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=admin
OutputBaseFilename=ActivityTrack-Setup-{#AppVersion}
OutputDir=Output
Compression=lzma2
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible

[Files]
; Staged by scripts/build-installer.mjs: node.exe + dist/ + node_modules/koffi
Source: "staging\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs

[Run]
; Register a per-machine scheduled task that runs at any user logon in their
; interactive session. /RL LIMITED keeps it at normal user rights.
Filename: "schtasks.exe"; \
  Parameters: "/Create /TN ""ActivityTrack Agent"" /TR ""'{app}\node.exe' '{app}\dist\index.js'"" /SC ONLOGON /RL LIMITED /F"; \
  Flags: runhidden

[UninstallRun]
Filename: "schtasks.exe"; Parameters: "/Delete /TN ""ActivityTrack Agent"" /F"; Flags: runhidden; RunOnceId: "DelTask"

[UninstallDelete]
; Device identity in %ProgramData% is intentionally NOT removed on uninstall so
; reinstalls keep the same device id. Delete manually if you want a clean id.
Type: filesandordirs; Name: "{app}"
