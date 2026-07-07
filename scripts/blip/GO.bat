@echo off
REM GO.bat — double-click on Windows. Purges junk, fresh sovereign install.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0PURGE-AND-GO.ps1"
pause
