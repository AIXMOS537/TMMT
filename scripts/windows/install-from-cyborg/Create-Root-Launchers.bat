@echo off
REM Copies agents launcher to USB root (some PCs lock root files until eject/reinsert)
cd /d "%~dp0\.."
copy /Y "%~dp0RUN-AGENTS.bat" "%CD%\START-AGENTS.bat" >nul 2>&1
if exist "%CD%\START-AGENTS.bat" (
    echo Created START-AGENTS.bat on USB root.
) else (
    echo Could not write USB root. Use install\RUN-AGENTS.bat instead.
)
pause
