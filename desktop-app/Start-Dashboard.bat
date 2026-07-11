@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title LSS Dashboard - Start

echo ============================================
echo   LSS Dashboard wird gestartet
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [Hinweis] Node.js wurde auf diesem Computer nicht gefunden.
  echo.
  echo LSS Dashboard benoetigt Node.js, um zu laufen ^(einmalig zu installieren^).
  echo Es oeffnet sich gleich die Download-Seite - bitte die Installation
  echo dort mit den Standardeinstellungen durchfuehren und diese Datei danach
  echo erneut per Doppelklick starten.
  echo.
  pause
  start "" "https://nodejs.org/de/download"
  exit /b 1
)

cd /d "%~dp0"

if not exist "node_modules" (
  echo Erststart erkannt - benoetigte Komponenten werden einmalig heruntergeladen.
  echo Das kann je nach Internetverbindung einige Minuten dauern, bitte warten ...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [Fehler] Die Einrichtung ist fehlgeschlagen. Bitte Internetverbindung
    echo pruefen und diese Datei erneut per Doppelklick starten.
    echo.
    pause
    exit /b 1
  )
  echo.
  echo Einrichtung abgeschlossen.
  echo.
)

echo Starte LSS Dashboard ...
call npm start

if errorlevel 1 (
  echo.
  echo [Fehler] LSS Dashboard konnte nicht gestartet werden.
  pause
)

endlocal
