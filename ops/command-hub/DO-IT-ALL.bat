@echo off
setlocal EnableDelayedExpansion
title AIXMOS — DO IT ALL
color 0B
set "ROOT=C:\Users\AIXMOS\CommandCenter"
set "LOG=%ROOT%\DO-IT-ALL.log"
set "TMMT=%ROOT%\tmmt-os"
set "SRC=E:\TMMT MANAGEMENT\tmmt-os"

echo. > "%LOG%"
echo === DO-IT-ALL %DATE% %TIME% === >> "%LOG%"

echo  [1/8] Scripts...
powershell -NoProfile -Command "Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force" >> "%LOG%" 2>&1

echo  [2/8] Login auto-start...
copy /Y "%ROOT%\AutoStart-DailyDriver.bat" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\CEO-DailyDriver.bat" >> "%LOG%" 2>&1

echo  [3/8] TMMT local copy...
if exist "%SRC%\package.json" (
  echo        USB found — copying...
  if not exist "%TMMT%" mkdir "%TMMT%"
  robocopy "%SRC%" "%TMMT%" /E /XO /R:2 /W:2 /XD .next .git .vercel /NFL /NDL /NJH /NJS /nc /ns /np /LOG:"%ROOT%\robocopy.log"
  echo robocopy=!ERRORLEVEL!>>"%LOG%"
  if exist "%SRC%\.env.local" copy /Y "%SRC%\.env.local" "%TMMT%\.env.local" >>"%LOG%" 2>&1
) else (
  echo        USB not in — using production only >> "%LOG%"
  echo        USB not in — production mode OK.
)

echo  [4/8] Node.js...
where node >nul 2>&1
if errorlevel 1 (
  echo NODE=missing>>"%LOG%"
  start "" "https://nodejs.org/"
) else (
  for /f %%v in ('node -v') do echo NODE=%%v>>"%LOG%"
  if exist "%TMMT%\package.json" if not exist "%TMMT%\node_modules\next" (
    echo        npm ci...
    pushd "%TMMT%" && call npm ci >> "%LOG%" 2>&1 && popd
  )
)

echo  [5/8] Desktop shortcut...
powershell -NoProfile -Command "$d=[Environment]::GetFolderPath('Desktop');$s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $d 'CEO Command Center.lnk'));$s.TargetPath='%ROOT%\CEO-Dashboard.html';$s.IconLocation='imageres.dll,109';$s.Save()" >>"%LOG%" 2>&1

echo  [6/8] Opening command center...
start "" "%ROOT%\CEO-Dashboard.html"
start "" "https://tmmt-ops.vercel.app/internal/briefing"
start "" "https://tmmt-ops.vercel.app/internal/dashboard"

echo  [7/8] Cursor...
if exist "%LOCALAPPDATA%\Programs\cursor\Cursor.exe" start "" "%LOCALAPPDATA%\Programs\cursor\Cursor.exe"

echo  [8/8] Status file...
(
  echo STATUS=READY
  echo MODE=production
  echo TIMESTAMP=%DATE% %TIME%
  if exist "%TMMT%\package.json" (echo tmmt_local=YES) else (echo tmmt_local=NO_USB)
  if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\CEO-DailyDriver.bat" (echo startup=YES) else (echo startup=NO)
) > "%ROOT%\setup-complete.txt"

echo.
echo  DONE — Muhammad Taha CEO Command Center is live.
echo  Production: https://tmmt-ops.vercel.app
if not exist "%TMMT%\package.json" echo  Tip: plug APP USB and run again for local copy.
echo  Log: %LOG%
echo.
timeout /t 10
