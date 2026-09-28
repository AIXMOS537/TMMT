@echo off
REM ============================================================
REM  AIXMOS - PUT THIS PC ON THE MESH
REM  Run this ONCE on each office/home computer you want to watch.
REM  Right-click -> "Run as administrator".
REM ============================================================
title Join AIXMOS Mesh
echo.
echo  Step 1 of 2: Installing Tailscale (the secure link)...
echo.
winget install --id Tailscale.Tailscale -e --accept-source-agreements --accept-package-agreements
echo.
echo  Step 2 of 2: Signing this PC into the mesh.
echo  A browser window will open. Log in with the AIXMOS537 account.
echo.
pause
"C:\Program Files\Tailscale\tailscale.exe" up --accept-routes
echo.
echo  ============================================================
echo   DONE. This computer is now on the mesh.
echo   It will appear on the tablet's Fleet Watchtower within a minute.
echo  ============================================================
echo.
pause
