@echo off
REM ============================================================
REM  AIXMOS - INSTALL THE AGENT (run on EVERY machine to watch)
REM  Reports this PC's CPU/RAM/disk/uptime + who's logged in +
REM  active app to the hub, and installs RustDesk for live screens.
REM  Right-click -> Run as administrator (for the RustDesk install).
REM ============================================================
title Install AIXMOS Agent

set "DEST=%LOCALAPPDATA%\AIXMOS-Agent"
if not exist "%DEST%" mkdir "%DEST%"
copy /Y "%~dp0aixmos-agent.ps1" "%DEST%\" >nul
copy /Y "%~dp0agent-run.vbs"   "%DEST%\" >nul

echo Setting the agent to start at every login...
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\AIXMOS Agent.lnk');$s.TargetPath='wscript.exe';$s.Arguments='\"%DEST%\agent-run.vbs\"';$s.WorkingDirectory='%DEST%';$s.Save()"

echo Starting the agent now...
start "" wscript "%DEST%\agent-run.vbs"

echo Installing RustDesk (for live screen view / remote control)...
winget install --id RustDesk.RustDesk -e --accept-source-agreements --accept-package-agreements

echo.
echo  ============================================================
echo   AGENT INSTALLED. This PC now reports to the hub.
echo   ONE-TIME for live screens: open RustDesk on this PC and set a
echo   permanent password (Settings -> Security). Note its ID.
echo  ============================================================
pause
