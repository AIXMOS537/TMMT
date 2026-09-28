@echo off
set "LOG=C:\Users\AIXMOS\CommandCenter\setup-complete.txt"
echo Setup started: %DATE% %TIME% > "%LOG%"

call "%USERPROFILE%\Desktop\Enable-Scripts-For-User.bat" >> "%LOG%" 2>&1

copy /Y "C:\Users\AIXMOS\CommandCenter\AutoStart-DailyDriver.bat" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\CEO-DailyDriver.bat" >> "%LOG%" 2>&1
echo Startup: OK >> "%LOG%"

if exist "C:\Users\AIXMOS\CommandCenter\tmmt-os\package.json" (
  echo Local TMMT: already installed >> "%LOG%"
) else if exist "E:\TMMT MANAGEMENT\tmmt-os\package.json" (
  echo Local TMMT: copying from USB... >> "%LOG%"
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\AIXMOS\CommandCenter\Install-Local.ps1" >> "%LOG%" 2>&1
) else (
  echo Local TMMT: skipped no USB >> "%LOG%"
)

where node >nul 2>&1
if errorlevel 1 (echo Node: MISSING >> "%LOG%") else (for /f %%v in ('node -v') do echo Node: %%v >> "%LOG%")

start "" "C:\Users\AIXMOS\CommandCenter\CEO-Dashboard.html"
start "" "https://tmmt-ops.vercel.app/internal/briefing"
echo Setup finished: %DATE% %TIME% >> "%LOG%"
echo STATUS=READY >> "%LOG%"
