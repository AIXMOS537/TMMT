@echo off
REM ============================================================
REM  SYNC BRAIN — saves the AI bot's memory to GitHub and pulls
REM  any updates from your other devices (Brainiac, Macs).
REM  Works once the GitHub remote is connected (see chat steps).
REM ============================================================
setlocal
set "BRAIN=C:\Users\AIXMOS\AIXMOS-Brain"
cd /d "%BRAIN%"

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo No GitHub remote connected yet.
  echo Run this once (after creating the private repo on github.com):
  echo   git -C "%BRAIN%" remote add origin https://github.com/Metavibez4L/AIXMOS-Brain.git
  echo   git -C "%BRAIN%" push -u origin main
  pause
  exit /b 1
)

echo Saving brain...
git add -A
git commit -m "brain sync %date% %time%" >nul 2>&1
echo Pulling updates from other devices...
git pull --rebase
echo Pushing...
git push
echo.
echo Brain synced.
timeout /t 2 /nobreak >nul
exit /b 0
