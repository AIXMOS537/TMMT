@echo off
:: TRAPTOP-WAKE.cmd — double-click to wake the TMMT Traptop engine.
:: PROJECT X HAILMARY — speaks 3-5 master passphrases to decrypt + start.
:: If the keys are wrong, nothing happens. 5 wrong attempts = 30 min lockout.
title TMMT TRAPTOP — PROJECT X HAILMARY
color 0B
echo.
echo   +====================================================+
echo   ^|   TMMT TRAPTOP — PROJECT X HAILMARY              ^|
echo   +====================================================+
echo.

:: Check for PowerShell
where powershell >nul 2>&1
if %errorlevel% neq 0 (
  echo   ERROR: PowerShell not found. Install PowerShell 5+.
  pause
  exit /b 1
)

:: Run the wake script
powershell -ExecutionPolicy Bypass -File "%~dp0traptop-wake.ps1" wake
echo.
pause
