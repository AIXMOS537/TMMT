@echo off
REM CEO Daily Driver — runs on Windows login (Muhammad Taha)
setlocal
timeout /t 8 /nobreak >nul

REM 1) HOME command center — family + friends + work, one screen
start "" "C:\Users\AIXMOS\CommandCenter\Home-Command-Center.html"

REM 2) CEO work briefing (production)
start "" "https://tmmt-ops.vercel.app/internal/briefing"

REM 3) Optional local dev server if installed
set "ROOT=C:\Users\AIXMOS\CommandCenter\tmmt-os"
if exist "%ROOT%\package.json" (
  where node >nul 2>&1 && call "C:\Users\AIXMOS\CommandCenter\AutoStart-Tmmt.bat"
)

exit /b 0
