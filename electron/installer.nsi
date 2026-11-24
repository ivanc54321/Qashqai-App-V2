!include "MUI2.nsh"

Unicode true
Name "Qashqai App V2"
OutFile "..\release\Qashqai-App-V2-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\Qashqai App V2"
InstallDirRegKey HKCU "Software\QashqaiAppV2" "InstallDir"
RequestExecutionLevel user

SetCompressor /SOLID lzma

!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\Qashqai App V2.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Qashqai App V2"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "..\release\win-unpacked\*.*"

  WriteRegStr HKCU "Software\QashqaiAppV2" "InstallDir" "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Start Menu Shortcuts
  CreateDirectory "$SMPROGRAMS\Qashqai App V2"
  CreateShortCut "$SMPROGRAMS\Qashqai App V2\Qashqai App V2.lnk" "$INSTDIR\Qashqai App V2.exe"
  CreateShortCut "$SMPROGRAMS\Qashqai App V2\Uninstall Qashqai App V2.lnk" "$INSTDIR\Uninstall.exe"

  ; Desktop Shortcut
  CreateShortCut "$DESKTOP\Qashqai App V2.lnk" "$INSTDIR\Qashqai App V2.exe"

  ; Add/Remove Programs (Installed Apps) entry
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\QashqaiAppV2" "DisplayName" "Qashqai App V2"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\QashqaiAppV2" "DisplayVersion" "2.0.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\QashqaiAppV2" "Publisher" "ivanc54321"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\QashqaiAppV2" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\QashqaiAppV2" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\QashqaiAppV2" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\QashqaiAppV2" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\Qashqai App V2.lnk"
  RMDir /r "$SMPROGRAMS\Qashqai App V2"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\QashqaiAppV2"
  DeleteRegKey HKCU "Software\QashqaiAppV2"
SectionEnd
