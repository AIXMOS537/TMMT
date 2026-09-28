@echo off
title Stop Fleet Watchtower
if exist "%~dp0watchtower.pid" (
  set /p WTPID=<"%~dp0watchtower.pid"
  taskkill /PID %WTPID% /F >nul 2>&1
  del "%~dp0watchtower.pid" >nul 2>&1
  echo Watchtower stopped.
) else (
  echo No running Watchtower found.
)
timeout /t 2 >nul
exit
