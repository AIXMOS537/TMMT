@echo off
setlocal enabledelayedexpansion
title TMMT Onboarding
color 0F
cls
echo ================ TMMT - THE MISSION ================
echo.
echo   Movement: Trap Money Moves Timeless (TMMT) - for the people, by the people.
echo.
echo   Mission: Help everyday people get out and bring their family with them -
echo   with systems, automation, and AI agents (AIXMOS) to run a real business
echo   and grow, ONE STEP AT A TIME, without having to ask or beg anyone.
echo.
echo   How we operate:
echo    - Agents-first. AIXMOS does the heavy lifting; people make the calls.
echo    - One step at a time.   - Protect the owner and the family. Always.
echo    - Only great, valuable information moves through the network.
echo    - Earn it, own it. Access is granted by the owner, scoped, revocable.
echo.
echo   The ask: become an agent of the mission. Use AIXMOS to do what you're here
echo   to do, leave it stronger, and never act against the owner or the family.
echo.
echo ====================================================
echo.
set "ACK="
set /p ACK="Type exactly:  I ACCEPT THE MISSION  then press Enter: "
if /i not "!ACK!"=="I ACCEPT THE MISSION" (
  echo.
  echo  [X] Mission not accepted. Onboarding stopped.
  echo.
  pause
  exit /b 1
)
echo  [OK] Mission acknowledged.
echo.
set "NAME="
set /p NAME="Full name / handle: "
set "ROLE="
set /p ROLE="Role (operator / developer / vendor / teammate): "
set "WHATT="
set /p WHATT="In one line: what will you own / move forward for the mission? "
set "SKILLS="
set /p SKILLS="Your skills / tools (comma-separated): "
set "STEP1="
set /p STEP1="Your FIRST step - the one move you will make next: "
set "CONSENT="
set /p CONSENT="Agree to: keep everything confidential, least-privilege access, never act against the owner/family? (yes/no): "
if /i not "!CONSENT!"=="yes" (
  echo.
  echo  [X] Onboarding requires agreement. Stopped.
  echo.
  pause
  exit /b 1
)

set "F=%USERPROFILE%\Desktop\TMMT-onboarding-card.txt"
(
  echo TMMT ONBOARDING - !NAME!
  echo mission_accepted: YES ^("I ACCEPT THE MISSION"^)
  echo device: Windows - %COMPUTERNAME%
  echo role: !ROLE!
  echo owns: !WHATT!
  echo skills: !SKILLS!
  echo first_step: !STEP1!
  echo agreed: yes
  echo confidentiality_agreed: yes ^(keep how/why secret^)
) > "!F!"

cls
echo ====================================================
echo   [OK] Welcome, !NAME! - you're in (pending the owner's grant).
echo ====================================================
echo.
echo   YOUR WORKFLOW:
echo     1. Mission accepted [x]
echo     2. You start in DEV (your sandbox) - you cannot break anything live.
echo     3. Your first step: !STEP1!
echo     4. SECURE YOURSELF: password manager + unique passwords + MFA.
echo     5. Access is granted by Muhammad after he reviews this.
echo.
echo   LAST STEP - send this file back to Muhammad:
echo     !F!
echo     (text / email that file to him so he can grant your access.)
echo.
pause
