Unicode true
!ifndef APP_VERSION
  !error "APP_VERSION must be passed from package.json by scripts/build-installer.cjs"
!endif
RequestExecutionLevel user
SetCompressor /SOLID zlib

!include "MUI2.nsh"
!define APP_EXE "حسابداری تمشک.exe"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\TameshkAccounting"
!define PRODUCT_KEY "Software\TameshkAccounting"
!define MUI_ABORTWARNING
!define MUI_ICON "../resources/app/icon.ico"
!define MUI_UNICON "../resources/app/icon.ico"
!define MUI_WELCOMEPAGE_TITLE "$(WELCOME_TITLE)"
!define MUI_WELCOMEPAGE_TEXT "$(WELCOME_TEXT)"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "$(RUN_TEXT)"

; Use explicit Windows language IDs; MUI language symbols are declared after these strings.
; English=1033, Farsi=1065 and Arabic=1025 match the bundled NSIS language tables.
!define APP_LANG_ENGLISH 1033
!define APP_LANG_FARSI 1065
!define APP_LANG_ARABIC 1025

LangString APP_NAME ${APP_LANG_ENGLISH} "Tameshk Accounting"
LangString APP_NAME ${APP_LANG_FARSI} "حسابداری تمشک"
LangString APP_NAME ${APP_LANG_ARABIC} "تمشك للمحاسبة"
LangString WELCOME_TITLE ${APP_LANG_ENGLISH} "Tameshk Accounting Setup"
LangString WELCOME_TITLE ${APP_LANG_FARSI} "نصب حسابداری تمشک"
LangString WELCOME_TITLE ${APP_LANG_ARABIC} "تثبيت تمشك للمحاسبة"
LangString WELCOME_TEXT ${APP_LANG_ENGLISH} "Install Tameshk Accounting for this Windows user. Click Next to continue."
LangString WELCOME_TEXT ${APP_LANG_FARSI} "حسابداری تمشک را برای این کاربر ویندوز نصب می‌کند. برای ادامه روی بعدی کلیک کنید."
LangString WELCOME_TEXT ${APP_LANG_ARABIC} "سيتم تثبيت تمشك للمحاسبة لهذا المستخدم في Windows. انقر فوق التالي للمتابعة."
LangString RUN_TEXT ${APP_LANG_ENGLISH} "Run Tameshk Accounting"
LangString RUN_TEXT ${APP_LANG_FARSI} "اجرای حسابداری تمشک"
LangString RUN_TEXT ${APP_LANG_ARABIC} "تشغيل تمشك للمحاسبة"
LangString SHORTCUT_NAME ${APP_LANG_ENGLISH} "Tameshk Accounting"
LangString SHORTCUT_NAME ${APP_LANG_FARSI} "حسابداری تمشک"
LangString SHORTCUT_NAME ${APP_LANG_ARABIC} "تمشك للمحاسبة"
LangString LOG_SHORTCUT ${APP_LANG_ENGLISH} "Open logs and diagnostics"
LangString LOG_SHORTCUT ${APP_LANG_FARSI} "گزارش خطا و لاگ‌ها"
LangString LOG_SHORTCUT ${APP_LANG_ARABIC} "فتح السجلات والتشخيص"
LangString INSTALL_FAILED ${APP_LANG_ENGLISH} "Installation did not complete. Log: $LOCALAPPDATA\TameshkAccounting\logs\installer.log. More details: Setup.exe /LOG=$TEMP\Tameshk-NSIS.log"
LangString INSTALL_FAILED ${APP_LANG_FARSI} "نصب کامل نشد. گزارش: $LOCALAPPDATA\TameshkAccounting\logs\installer.log. جزئیات بیشتر: Setup.exe /LOG=$TEMP\Tameshk-NSIS.log"
LangString INSTALL_FAILED ${APP_LANG_ARABIC} "لم يكتمل التثبيت. السجل: $LOCALAPPDATA\TameshkAccounting\logs\installer.log. تفاصيل إضافية: Setup.exe /LOG=$TEMP\Tameshk-NSIS.log"

Name "$(APP_NAME)"
OutFile "../dist/Tameshk-Accounting-Setup-${APP_VERSION}-x64.exe"
InstallDir "$LOCALAPPDATA\Programs\TameshkAccounting"
InstallDirRegKey HKCU "${PRODUCT_KEY}" "InstallDir"
ShowInstDetails show
ShowUnInstDetails show

!macro WriteSetupLog TEXT
  CreateDirectory "$LOCALAPPDATA\TameshkAccounting\logs"
  FileOpen $R9 "$LOCALAPPDATA\TameshkAccounting\logs\installer.log" "a"
  IfErrors +2
  FileWrite $R9 "${TEXT}$\n"
  FileClose $R9
!macroend

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Farsi"
!insertmacro MUI_LANGUAGE "Arabic"

; Generated during packaging: explicit File statements for every app payload file.
!include "payload.generated.nsh"

Function .onInit
  StrCpy $LANGUAGE ${APP_LANG_ENGLISH}
  !insertmacro MUI_LANGDLL_DISPLAY
  !insertmacro WriteSetupLog "Setup started."
FunctionEnd

Function .onInstSuccess
  !insertmacro WriteSetupLog "Installation finished successfully."
FunctionEnd

Function .onInstFailed
  !insertmacro WriteSetupLog "ERROR: installation failed; run Setup.exe with /LOG=path for verbose NSIS diagnostics."
FunctionEnd

Function un.onInit
  !insertmacro WriteSetupLog "Uninstall started."
FunctionEnd

Function un.onUninstSuccess
  !insertmacro WriteSetupLog "Uninstall completed; application data and logs were preserved."
FunctionEnd

Function un.onUninstFailed
  !insertmacro WriteSetupLog "ERROR: uninstall failed; run uninstaller with /LOG=path for verbose NSIS diagnostics."
FunctionEnd

Section "Install"
  SetShellVarContext current
  CreateDirectory "$INSTDIR"
  IfErrors setupFailed
  SetOutPath "$INSTDIR"
  ; Remove the former branded executable when upgrading without changing appId or userData.
  Delete "$INSTDIR\حسابداری کافی‌نت تمشک.exe"
  !insertmacro InstallPayload
  IfErrors setupFailed
  !insertmacro WriteSetupLog "Application files copied to: $INSTDIR"

  CreateDirectory "$SMPROGRAMS\Tameshk Accounting"
  CreateShortCut "$SMPROGRAMS\Tameshk Accounting\$(SHORTCUT_NAME).lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  IfErrors setupFailed
  CreateShortCut "$SMPROGRAMS\Tameshk Accounting\$(LOG_SHORTCUT).lnk" "$WINDIR\explorer.exe" "$LOCALAPPDATA\TameshkAccounting\logs"
  CreateShortCut "$DESKTOP\$(SHORTCUT_NAME).lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\resources\app\desktop-shortcut.ico" 0
  IfErrors setupFailed

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "${PRODUCT_KEY}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "$(APP_NAME)"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
  !insertmacro WriteSetupLog "Shortcuts and uninstall registration created."
  Goto setupDone

setupFailed:
  System::Call 'kernel32::GetLastError() i.r0'
  IntFmt $R8 "0x%X" $R0
  !insertmacro WriteSetupLog "ERROR: install stage failed. Windows error code: $R8"
  MessageBox MB_ICONSTOP "$(INSTALL_FAILED)"
  Abort
setupDone:
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  Delete "$DESKTOP\$(SHORTCUT_NAME).lnk"
  Delete "$SMPROGRAMS\Tameshk Accounting\$(SHORTCUT_NAME).lnk"
  Delete "$SMPROGRAMS\Tameshk Accounting\$(LOG_SHORTCUT).lnk"
  ; Remove links from older releases with the former product name.
  Delete "$DESKTOP\حسابداری کافی‌نت تمشک.lnk"
  Delete "$SMPROGRAMS\Tameshk Accounting\حسابداری کافی‌نت تمشک.lnk"
  Delete "$SMPROGRAMS\Tameshk Accounting\گزارش خطا و لاگ‌ها.lnk"
  RMDir "$SMPROGRAMS\Tameshk Accounting"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
  DeleteRegKey HKCU "${PRODUCT_KEY}"
  RMDir /r "$INSTDIR"
  !insertmacro WriteSetupLog "Installed application files removed; local application data and logs retained."
SectionEnd
