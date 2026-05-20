@echo off
REM One-time per PC: enable plug-and-play when this USB is inserted (requires Admin)
net session >nul 2>&1
if errorlevel 1 (
    echo Requesting Administrator...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0\.."
set "USB_SETUP_ROOT=%CD%"
echo.
echo  USB Plug-and-Play registration
echo  =============================
echo  Kit: %USB_SETUP_ROOT%
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Register-UsbAutoRun.ps1" -KitRoot "%USB_SETUP_ROOT%"

echo.
echo  Optional: label this drive CURSOR-SETUP (Admin):
echo    powershell -ExecutionPolicy Bypass -File "%~dp0Set-UsbVolumeLabel.ps1" -DriveLetter D
echo.
echo  Done. Eject and re-insert USB to test auto-run, or double-click START-AGENTS.bat
pause
