; Custom NSIS installer hooks for ActivityTrack.
; Tauri injects these macros at the matching points of its generated installer.
;
; The release workflow (release.yml) overwrites this file at build time, baking
; the real convexUrl / ingestKey / clerkPublishableKey values from GitHub
; secrets directly into the FileWrite call. The empty values here are the
; fallback for local/dev builds where the secrets aren't available.
;
; On install: (1) creates %ProgramData%\ActivityTrack\config.json if it doesn't
; exist yet, so IT can still place their own config.json before first run and it
; won't be overwritten; (2) registers a per-MACHINE (HKLM) logon autostart so the
; tracker starts for EVERY user in their interactive session — required for idle
; detection, which only works in an interactive session. (A per-user HKCU Run key
; would only auto-start for whoever first ran the app.) The single-instance guard
; in the app makes a stray second launch harmless.

!macro NSIS_HOOK_POSTINSTALL
  Push $0
  CreateDirectory "$COMMONAPPDATA\ActivityTrack"
  IfFileExists "$COMMONAPPDATA\ActivityTrack\config.json" nsis_at_config_exists
  FileOpen $0 "$COMMONAPPDATA\ActivityTrack\config.json" w
  FileWrite $0 '{"convexUrl":"","ingestKey":"","clerkPublishableKey":""}'
  FileClose $0
  nsis_at_config_exists:
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "ActivityTrack" '"$INSTDIR\ActivityTrack.exe"'
  Pop $0
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "ActivityTrack"
!macroend

