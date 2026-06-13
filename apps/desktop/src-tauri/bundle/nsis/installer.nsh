; Custom NSIS installer script for ActivityTrack
; Handles copying the pre-built config.json to %ProgramData%\ActivityTrack

!macro preLaunchCommand
  ; Create the ActivityTrack config directory in %ProgramData%
  CreateDirectory "$%ProgramData%\ActivityTrack"

  ; Copy config.json from the bundle to %ProgramData% (only if it doesn't exist)
  ${If} ${FileExists} "$INSTDIR\config.json"
    IfFileExists "$%ProgramData%\ActivityTrack\config.json" skipConfigCopy
      CopyFiles "$INSTDIR\config.json" "$%ProgramData%\ActivityTrack\config.json"
    skipConfigCopy:
  ${EndIf}
!macroend
