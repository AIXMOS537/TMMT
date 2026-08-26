@echo off
REM ============================================================
REM  AIXMOS - INSTALL PHONE ALERTS
REM  Run this ONCE, on BRAINIAC (the hub).  Run as administrator.
REM  Pushes your phone when any machine goes down / comes back /
REM  runs low on disk. Uses the free "ntfy" app.
REM ============================================================
title Install AIXMOS Phone Alerts
net session >nul 2>&1
if errorlevel 1 ( echo Please RIGHT-CLICK -> Run as administrator. & pause & exit /b )

set "DEST=C:\ProgramData\AIXMOS-Watchtower"
if not exist "%DEST%" mkdir "%DEST%"
copy /Y "%~dp0aixmos-alerts.ps1" "%DEST%\" >nul

REM generate a private, hard-to-guess topic the first time
if not exist "%DEST%\alerts-topic.txt" (
  powershell -NoProfile -Command "('aixmos-' + ([guid]::NewGuid().ToString('N'))) | Out-File -Encoding ascii -NoNewline '%DEST%\alerts-topic.txt'"
)
set /p TOPIC=<"%DEST%\alerts-topic.txt"

schtasks /create /tn "AIXMOS Alerts" /sc onstart /ru SYSTEM /rl HIGHEST /f ^
 /tr "powershell -NoProfile -ExecutionPolicy Bypass -File \"%DEST%\aixmos-alerts.ps1\"" >nul
schtasks /run /tn "AIXMOS Alerts" >nul

echo.
echo  ============================================================
echo   PHONE ALERTS ARE LIVE.
echo   On your phone: install the "ntfy" app (App Store / Play),
echo   tap Subscribe, server = ntfy.sh, topic = the line below:
echo.
echo        %TOPIC%
echo.
echo   You'll get a test "Alerts are now armed" push within a minute.
echo  ============================================================
pause
