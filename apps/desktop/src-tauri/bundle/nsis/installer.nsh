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
; ActivityTrackUpdate scheduled task: runs as SYSTEM so no UAC prompt is needed
; to trigger it, has no trigger of its own (a ONCE trigger dated in the past
; never auto-fires — it only runs when the app calls `schtasks /Run`), and its
; action is a FIXED command pointed at %ProgramData%\ActivityTrack\update\
; pending-update.exe. See updater_apply.rs for why that path must stay fixed and
; who is (and isn't) allowed to write to it. Re-registered on every
; install/update.
;
; Registration goes through a base64 `-EncodedCommand` PowerShell blob (decoded
; in comments/history — see release.yml and updater_apply.rs) rather than
; `schtasks /Create`, for two reasons proven necessary by hand-testing on a
; real machine: (a) `schtasks /Create`'s default security descriptor for a
; `/RU SYSTEM` task only lets Administrators start it — plain CLI creation has
; no way to grant the built-in Users group permission to trigger it, only the
; Task Scheduler COM API's RegisterTaskDefinition(..., Sddl) does; and
; (b) EncodedCommand's base64 payload has zero characters that need escaping
; through NSIS -> PowerShell -> schtasks, unlike a hand-quoted `/TR` value.
;
; The base64 blob below is this script, UTF-16LE + base64 encoded (regenerate
; with: [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
; -- keep release.yml's copy of the same blob in sync if you change this):
;
;   $ErrorActionPreference='Stop'
;   $t=Join-Path $env:ProgramData 'ActivityTrack\update\pending-update.exe'
;   $s=New-Object -ComObject 'Schedule.Service'
;   $s.Connect()
;   $f=$s.GetFolder('\')
;   $d=$s.NewTask(0)
;   $d.Settings.Enabled=$true
;   $d.Settings.AllowDemandStart=$true
;   $d.Settings.DisallowStartIfOnBatteries=$false
;   $d.Settings.StopIfGoingOnBatteries=$false
;   $a=$d.Actions.Create(0)
;   $a.Path=$t
;   $a.Arguments='/S /R /UPDATE /ARGS ""'
;   $sddl='D:(A;;GA;;;SY)(A;;GA;;;BA)(A;;GRGX;;;BU)'
;   $f.RegisterTaskDefinition('ActivityTrackUpdate',$d,6,'SYSTEM',$null,5,$sddl)|Out-Null

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
  nsExec::Exec `"$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -EncodedCommand JABFAHIAcgBvAHIAQQBjAHQAaQBvAG4AUAByAGUAZgBlAHIAZQBuAGMAZQA9ACcAUwB0AG8AcAAnAAoAJAB0AD0ASgBvAGkAbgAtAFAAYQB0AGgAIAAkAGUAbgB2ADoAUAByAG8AZwByAGEAbQBEAGEAdABhACAAJwBBAGMAdABpAHYAaQB0AHkAVAByAGEAYwBrAFwAdQBwAGQAYQB0AGUAXABwAGUAbgBkAGkAbgBnAC0AdQBwAGQAYQB0AGUALgBlAHgAZQAnAAoAJABzAD0ATgBlAHcALQBPAGIAagBlAGMAdAAgAC0AQwBvAG0ATwBiAGoAZQBjAHQAIAAnAFMAYwBoAGUAZAB1AGwAZQAuAFMAZQByAHYAaQBjAGUAJwAKACQAcwAuAEMAbwBuAG4AZQBjAHQAKAApAAoAJABmAD0AJABzAC4ARwBlAHQARgBvAGwAZABlAHIAKAAnAFwAJwApAAoAJABkAD0AJABzAC4ATgBlAHcAVABhAHMAawAoADAAKQAKACQAZAAuAFMAZQB0AHQAaQBuAGcAcwAuAEUAbgBhAGIAbABlAGQAPQAkAHQAcgB1AGUACgAkAGQALgBTAGUAdAB0AGkAbgBnAHMALgBBAGwAbABvAHcARABlAG0AYQBuAGQAUwB0AGEAcgB0AD0AJAB0AHIAdQBlAAoAJABkAC4AUwBlAHQAdABpAG4AZwBzAC4ARABpAHMAYQBsAGwAbwB3AFMAdABhAHIAdABJAGYATwBuAEIAYQB0AHQAZQByAGkAZQBzAD0AJABmAGEAbABzAGUACgAkAGQALgBTAGUAdAB0AGkAbgBnAHMALgBTAHQAbwBwAEkAZgBHAG8AaQBuAGcATwBuAEIAYQB0AHQAZQByAGkAZQBzAD0AJABmAGEAbABzAGUACgAkAGEAPQAkAGQALgBBAGMAdABpAG8AbgBzAC4AQwByAGUAYQB0AGUAKAAwACkACgAkAGEALgBQAGEAdABoAD0AJAB0AAoAJABhAC4AQQByAGcAdQBtAGUAbgB0AHMAPQAnAC8AUwAgAC8AUgAgAC8AVQBQAEQAQQBUAEUAIAAvAEEAUgBHAFMAIAAiACIAJwAKACQAcwBkAGQAbAA9ACcARAA6ACgAQQA7ADsARwBBADsAOwA7AFMAWQApACgAQQA7ADsARwBBADsAOwA7AEIAQQApACgAQQA7ADsARwBSAEcAWAA7ADsAOwBCAFUAKQAnAAoAJABmAC4AUgBlAGcAaQBzAHQAZQByAFQAYQBzAGsARABlAGYAaQBuAGkAdABpAG8AbgAoACcAQQBjAHQAaQB2AGkAdAB5AFQAcgBhAGMAawBVAHAAZABhAHQAZQAnACwAJABkACwANgAsACcAUwBZAFMAVABFAE0AJwAsACQAbgB1AGwAbAAsADUALAAkAHMAZABkAGwAKQB8AE8AdQB0AC0ATgB1AGwAbAAKAA==`
  Pop $0
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "ActivityTrack"
  nsExec::Exec `"$SYSDIR\schtasks.exe" /Delete /TN "ActivityTrackUpdate" /F`
!macroend
