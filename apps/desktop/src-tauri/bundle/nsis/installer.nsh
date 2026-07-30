; Custom NSIS installer hooks for ActivityTrack.
; Tauri injects these macros at the matching points of its generated installer.
;
; The release workflow (release.yml) overwrites this file at build time, baking
; the real convexUrl / apiUrl values from GitHub secrets directly into the
; FileWrite call. Both are plain URLs (no secrets) — the device's only credential
; is the per-device token it earns at approval. The empty values here are the
; fallback for local/dev builds.
;
; On install: (1) creates %ProgramData%\ActivityTrack\config.json if it doesn't
; exist yet, so IT can still place their own config.json before first run and it
; won't be overwritten; (2) registers a per-MACHINE (HKLM) logon autostart so the
; tracker starts for EVERY user in their interactive session — required for idle
; detection, which only works in an interactive session. (A per-user HKCU Run key
; would only auto-start for whoever first ran the app.) The single-instance guard
; in the app makes a stray second launch harmless; (3) registers the
; ActivityTrackUpdate scheduled task: runs as SYSTEM so no UAC prompt is needed,
; has no trigger of its own (a ONCE trigger dated in the past never auto-fires —
; it only runs when the app calls `schtasks /Run`), and its action is a FIXED
; command pointed at update\pending-update.exe. See updater_apply.rs for why
; that path must stay fixed and who is (and isn't) allowed to write to it.
; Re-registered on every install/update so its target always matches $INSTDIR.

!macro NSIS_HOOK_POSTINSTALL
  Push $0
  CreateDirectory "$COMMONAPPDATA\ActivityTrack"
  CreateDirectory "$COMMONAPPDATA\ActivityTrack\update"
  IfFileExists "$COMMONAPPDATA\ActivityTrack\config.json" nsis_at_config_exists
  FileOpen $0 "$COMMONAPPDATA\ActivityTrack\config.json" w
  FileWrite $0 '{"convexUrl":"","apiUrl":""}'
  FileClose $0
  nsis_at_config_exists:
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "ActivityTrack" '"$INSTDIR\ActivityTrack.exe"'
  nsExec::Exec `"$SYSDIR\schtasks.exe" /Create /TN "ActivityTrackUpdate" /TR "\"$INSTDIR\update\pending-update.exe\" /S /R /UPDATE /ARGS \"\"" /SC ONCE /ST 00:00 /SD 01/01/1980 /RL HIGHEST /RU SYSTEM /F`
  Pop $0
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "ActivityTrack"
  nsExec::Exec `"$SYSDIR\schtasks.exe" /Delete /TN "ActivityTrackUpdate" /F`
!macroend
