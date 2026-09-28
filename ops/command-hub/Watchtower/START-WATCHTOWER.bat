@echo off
title Fleet Watchtower
echo Starting AIXMOS Fleet Watchtower...
start "" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fleet-watchtower.ps1"
timeout /t 2 >nul
start "" http://127.0.0.1:8787/
exit
