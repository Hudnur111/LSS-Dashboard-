@echo off
setlocal enabledelayedexpansion

set "APP_NAME=LSS Dashboard"
set "INSTALL_DIR=%LOCALAPPDATA%\LSSDashboard"
set "SOURCE_DIR=%~dp0"
set "EXE_NAME=LSS Dashboard.exe"

echo ============================================
echo   %APP_NAME% - Installation
echo ============================================
echo.

if not exist "%SOURCE_DIR%%EXE_NAME%" (
  echo [Fehler] "%EXE_NAME%" wurde neben install.bat nicht gefunden.
  echo Bitte zuerst das vollstaendige portable Release-Archiv entpacken
  echo ^(erzeugt via "npm run build:win" -^> dist\%EXE_NAME%^) und diese
  echo install.bat in denselben Ordner legen.
  pause
  exit /b 1
)

echo Installiere nach "%INSTALL_DIR%" ...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
robocopy "%SOURCE_DIR%." "%INSTALL_DIR%" /E /XF install.bat uninstall.bat create-shortcut.ps1 >nul

echo Erstelle Verknuepfungen ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-shortcut.ps1" ^
  -TargetPath "%INSTALL_DIR%\%EXE_NAME%" ^
  -ShortcutName "%APP_NAME%" ^
  -DesktopShortcut -StartMenuShortcut

if errorlevel 1 (
  echo [Warnung] Verknuepfungen konnten nicht automatisch erstellt werden.
) else (
  echo Verknuepfungen auf Desktop und im Startmenue erstellt.
)

echo.
echo Installation abgeschlossen.
set /p LAUNCH="%APP_NAME% jetzt starten? (J/N): "
if /I "%LAUNCH%"=="J" start "" "%INSTALL_DIR%\%EXE_NAME%"

endlocal
