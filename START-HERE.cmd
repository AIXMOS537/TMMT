@echo off
REM  TMMT - double-click this on Windows. Then pick a number.
cd /d "%~dp0"
where bash >nul 2>nul
if %errorlevel%==0 (
  bash scripts/start.sh
) else (
  echo.
  echo   TMMT needs "Git for Windows" the very first time ^(one-time^).
  echo   1^) Get it free here:  https://git-scm.com/download/win
  echo   2^) Install it - just keep clicking Next.
  echo   3^) Then double-click START-HERE.cmd again.
  echo.
  pause
)
