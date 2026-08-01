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
; Registration goes through the Task Scheduler COM API's
; RegisterTaskDefinition(..., Sddl) rather than `schtasks /Create`, because
; `schtasks /Create`'s default security descriptor for a `/RU SYSTEM` task only
; lets Administrators start it — plain CLI creation has no way to grant the
; built-in Users group permission to trigger it, only the COM API's explicit
; Sddl parameter does (hand-verified on a real machine).
;
; That COM call has to run from real PowerShell script, so this hook writes one
; to disk ($COMMONPROGRAMDATA\ActivityTrack\register-task.ps1, every `$` doubled
; to `$$` so NSIS doesn't try to expand it as its own variable) and runs it with
; `-File` rather than inlining the script as a `-EncodedCommand` base64 blob on
; the command line. Both were tried; `-EncodedCommand` reliably broke in ways
; `-File` doesn't:
;   - This build of makensis (the one tauri-cli downloads to
;     %LOCALAPPDATA%\tauri\NSIS) is NOT a large-strings build: bisection
;     (StrCpy into a numbered variable truncates silently at 1023 chars
;     regardless of source length) confirms plain NSIS_MAX_STRLEN=1024.
;   - The generated installer.exe is a 32-bit (x86) binary, like all standard
;     NSIS output, even though it installs a 64-bit app. Launching 64-bit
;     PowerShell via Sysnative (see below) from a 32-bit process means
;     CreateProcess is doing a cross-bitness WOW64 launch, and a long
;     `-EncodedCommand` argument came back corrupted through that path
;     specifically ("value specified with -EncodedCommand is not properly
;     encoded") even at a length (~1480 chars) that worked fine same-bitness
;     (32-bit installer -> 32-bit PowerShell). A `-File <path>` command line is
;     short regardless of script length, so this class of bug doesn't apply.
;
; The registration step's exit code + output are captured (ExecToStack) and
; written to update-task-register.log next to config.json, since a silent
; nsExec failure here is otherwise invisible. No try/catch needed for that:
; $ErrorActionPreference='Stop' already makes an uncaught RegisterTaskDefinition
; failure print PowerShell's full terminating-error text (line, exception type,
; message) to the same stream ExecToStack captures -- confirmed by hand.
;
; Every path here previously wrote to $COMMONAPPDATA, which isn't a real NSIS
; constant -- NSIS silently treats any unrecognized $Name as a fresh,
; permanently-empty variable instead of erroring, so every
; CreateDirectory/FileOpen/IfFileExists using it was silently acting on the
; malformed path "\ActivityTrack\...". The correct, SetShellVarContext-
; independent constant for %ProgramData% is $COMMONPROGRAMDATA.
;
; A 32-bit process's access to the literal path $WINDIR\System32\... is
; silently redirected by WOW64 to $WINDIR\SysWOW64\... -- so a plain
; "$WINDIR\System32\...\powershell.exe" (or NSIS's own $SYSDIR, which is
; equally WOW64-aware) launches 32-bit PowerShell, not the 64-bit one every
; hand test in an already-64-bit shell actually exercised. $WINDIR\Sysnative\...
; bypasses the redirection and forces the real 64-bit binary regardless of
; caller bitness.

!macro NSIS_HOOK_POSTINSTALL
  Push $0
  CreateDirectory "$COMMONPROGRAMDATA\ActivityTrack"
  CreateDirectory "$COMMONPROGRAMDATA\ActivityTrack\update"
  IfFileExists "$COMMONPROGRAMDATA\ActivityTrack\config.json" nsis_at_config_exists
  FileOpen $0 "$COMMONPROGRAMDATA\ActivityTrack\config.json" w
  FileWrite $0 '{"convexUrl":"","apiUrl":""}'
  FileClose $0
  nsis_at_config_exists:
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "ActivityTrack" '"$INSTDIR\ActivityTrack.exe"'

  FileOpen $0 "$COMMONPROGRAMDATA\ActivityTrack\register-task.ps1" w
  FileWrite $0 `$$ErrorActionPreference='Stop'$\r$\n`
  FileWrite $0 `$$t=Join-Path $$env:ProgramData 'ActivityTrack\update\pending-update.exe'$\r$\n`
  FileWrite $0 `$$s=New-Object -ComObject 'Schedule.Service'$\r$\n`
  FileWrite $0 `$$s.Connect()$\r$\n`
  FileWrite $0 `$$f=$$s.GetFolder('\')$\r$\n`
  FileWrite $0 `$$d=$$s.NewTask(0)$\r$\n`
  FileWrite $0 `$$d.Settings.Enabled=$$true$\r$\n`
  FileWrite $0 `$$d.Settings.AllowDemandStart=$$true$\r$\n`
  FileWrite $0 `$$d.Settings.DisallowStartIfOnBatteries=$$false$\r$\n`
  FileWrite $0 `$$d.Settings.StopIfGoingOnBatteries=$$false$\r$\n`
  FileWrite $0 `$$a=$$d.Actions.Create(0)$\r$\n`
  FileWrite $0 `$$a.Path=$$t$\r$\n`
  FileWrite $0 `$$a.Arguments='/S /R /UPDATE /ARGS ""'$\r$\n`
  FileWrite $0 `$$sddl='D:(A;;GA;;;SY)(A;;GA;;;BA)(A;;GRGX;;;BU)'$\r$\n`
  FileWrite $0 `$$f.RegisterTaskDefinition('ActivityTrackUpdate',$$d,6,'SYSTEM',$$null,5,$$sddl)|Out-Null$\r$\n`
  FileClose $0

  nsExec::ExecToStack `"$WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$COMMONPROGRAMDATA\ActivityTrack\register-task.ps1"`
  Pop $2
  Pop $3
  FileOpen $1 "$COMMONPROGRAMDATA\ActivityTrack\update-task-register.log" w
  FileWrite $1 "exit=$2$\r$\n$3"
  FileClose $1
  Delete "$COMMONPROGRAMDATA\ActivityTrack\register-task.ps1"
  Pop $0
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "ActivityTrack"
  nsExec::Exec `"$WINDIR\Sysnative\schtasks.exe" /Delete /TN "ActivityTrackUpdate" /F`
!macroend
