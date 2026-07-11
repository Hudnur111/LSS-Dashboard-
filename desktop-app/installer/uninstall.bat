@echo off
setlocal

set "APP_NAME=LSS Dashboard"
set "INSTALL_DIR=%LOCALAPPDATA%\LSSDashboard"

echo Entferne %APP_NAME% ...
del "%USERPROFILE%\Desktop\%APP_NAME%.lnk" 2>nul
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\%APP_NAME%.lnk" 2>nul

if exist "%INSTALL_DIR%" (
  rmdir /S /Q "%INSTALL_DIR%"
  echo Installationsverzeichnis entfernt.
) else (
  echo Kein Installationsverzeichnis gefunden.
)

echo.
echo Hinweis: Der verschluesselte API-Token unter
echo "%%APPDATA%%\LSS Dashboard\secure" wird von diesem Script NICHT geloescht.
echo Fuehre dazu in der App vor der Deinstallation "Token entfernen" aus,
echo oder loesche den Ordner manuell.
pause
endlocal
