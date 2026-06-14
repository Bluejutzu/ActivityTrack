; Custom NSIS installer hooks for ActivityTrack.
; Tauri injects these macros at the matching points of its generated installer.
; We use the post-install hook to seed %ProgramData%\ActivityTrack\config.json
; from the config bundled into the install dir (which the release workflow fills
; from GitHub secrets at build time) — without overwriting an existing config.

!macro NSIS_HOOK_POSTINSTALL
  CreateDirectory "$COMMONAPPDATA\ActivityTrack"
  ${If} ${FileExists} "$INSTDIR\config.json"
    ${IfNot} ${FileExists} "$COMMONAPPDATA\ActivityTrack\config.json"
      CopyFiles /SILENT "$INSTDIR\config.json" "$COMMONAPPDATA\ActivityTrack\config.json"
    ${EndIf}
  ${EndIf}
!macroend
