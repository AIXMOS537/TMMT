@echo off
setlocal EnableDelayedExpansion
title Health Check — Muhammad Taha
set "ROOT=C:\Users\AIXMOS\CommandCenter"
set "TMMT=%ROOT%\tmmt-os"
set "LOG=%ROOT%\health-check.txt"
set "PROD=https://tmmt-ops.vercel.app"

(
  echo HEALTH CHECK — %DATE% %TIME%
  echo.
) > "%LOG%"

REM Production
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri '%PROD%' -UseBasicParsing -TimeoutSec 15; 'production_http=' + $r.StatusCode } catch { 'production_http=FAIL ' + $_.Exception.Message }" >> "%LOG%" 2>&1

REM Files
if exist "%ROOT%\Home-Command-Center.html" (echo home_dashboard=YES>>"%LOG%") else (echo home_dashboard=NO>>"%LOG%")
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\CEO-DailyDriver.bat" (echo login_startup=YES>>"%LOG%") else (echo login_startup=NO>>"%LOG%")
if exist "%TMMT%\package.json" (echo tmmt_package=YES>>"%LOG%") else (echo tmmt_package=NO>>"%LOG%")
if exist "%TMMT%\node_modules\next" (echo tmmt_deps=YES>>"%LOG%") else (echo tmmt_deps=NO>>"%LOG%")
if exist "%TMMT%\.env.local" (echo tmmt_env=YES>>"%LOG%") else (echo tmmt_env=NO>>"%LOG%")
if exist "%TMMT%\src\app" (echo tmmt_source=YES>>"%LOG%") else (echo tmmt_source=NO>>"%LOG%")

REM Node
where node >nul 2>&1
if errorlevel 1 (echo node=MISSING>>"%LOG%") else (for /f %%v in ('node -v') do echo node=%%v>>"%LOG%")

REM Fix deps if needed
if exist "%TMMT%\package.json" if not exist "%TMMT%\node_modules\next" (
  echo.>>"%LOG%"
  echo FIX: running npm ci...>>"%LOG%"
  where node >nul 2>&1
  if not errorlevel 1 (
    pushd "%TMMT%"
    call npm ci >> "%LOG%" 2>&1
    popd
    if exist "%TMMT%\node_modules\next" (echo npm_ci=SUCCESS>>"%LOG%") else (echo npm_ci=FAILED>>"%LOG%")
  )
)

echo.>>"%LOG%"
echo === SUMMARY ===>>"%LOG%"
findstr /C:"production_http=" /C:"login_startup=" /C:"tmmt_deps=" /C:"node=" "%LOG%"

start notepad "%LOG%"
echo.
echo  Health check saved to:
echo  %LOG%
echo.
type "%LOG%"
echo.
pause
