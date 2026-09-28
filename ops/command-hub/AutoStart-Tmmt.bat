@echo off
REM Auto-start TMMT OS on login (CEO command center)
set "ROOT=C:\Users\AIXMOS\CommandCenter\tmmt-os"
if not exist "%ROOT%\package.json" exit /b 0
where node >nul 2>&1 || exit /b 0
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 exit /b 0
cd /d "%ROOT%"
if not exist "node_modules\next" call npm ci >nul 2>&1
start "TMMT CEO" /min cmd /c "cd /d \"%ROOT%\" && npm run dev"
timeout /t 5 /nobreak >nul
start "" "http://localhost:3000/internal/briefing"
