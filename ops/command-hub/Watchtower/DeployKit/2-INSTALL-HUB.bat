@echo off
REM ============================================================
REM  AIXMOS - INSTALL THE WATCHTOWER HUB
REM  Run this ONCE, on BRAINIAC only.  Right-click -> Run as administrator.
REM  Makes Brainiac the always-on hub that collects every machine's
REM  health + activity and serves the live dashboard on port 8787.
REM ============================================================
title Install AIXMOS Watchtower HUB
net session >nul 2>&1
if errorlevel 1 (
  echo Please RIGHT-CLICK this file and choose "Run as administrator".
  pause & exit /b
)

set "DEST=C:\ProgramData\AIXMOS-Watchtower"
if not exist "%DEST%" mkdir "%DEST%"
copy /Y "%~dp0fleet-watchtower.ps1" "%DEST%\" >nul

echo Allowing the hub to accept reports over the mesh...
netsh http add urlacl url=http://+:8787/ user=Everyone >nul 2>&1
netsh advfirewall firewall delete rule name="AIXMOS Watchtower 8787" >nul 2>&1
netsh advfirewall firewall add rule name="AIXMOS Watchtower 8787" dir=in action=allow protocol=TCP localport=8787 remoteip=100.64.0.0/10 >nul

echo Setting the hub to start automatically and run always-on...
schtasks /create /tn "AIXMOS Watchtower" /sc onstart /ru SYSTEM /rl HIGHEST /f ^
 /tr "powershell -NoProfile -ExecutionPolicy Bypass -File \"%DEST%\fleet-watchtower.ps1\" -Bind + -NoBrowser" >nul
schtasks /run /tn "AIXMOS Watchtower" >nul

echo Installing RustDesk (so this PC's screen can be viewed too)...
winget install --id RustDesk.RustDesk -e --accept-source-agreements --accept-package-agreements

echo.
echo  ============================================================
echo   HUB IS LIVE on this machine (port 8787).
echo   From the tablet, open:  http://100.117.163.93:8787
echo   Next: run 3-INSTALL-AGENT.bat on EVERY machine (incl. this one).
echo  ============================================================
pause
