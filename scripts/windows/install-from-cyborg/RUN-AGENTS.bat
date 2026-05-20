@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."
set "USB_SETUP_ROOT=%CD%"
title Run Agents (USB)
echo.
echo  Cursor Agents - Plug and Play
echo  =============================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Run-Agents-PlugAndPlay.ps1"
set EXITCODE=%ERRORLEVEL%
echo.
if "%EXITCODE%"=="0" (echo Agents ready. Reload Cursor.) else (echo Exit code %EXITCODE%.)
pause
exit /b %EXITCODE%
