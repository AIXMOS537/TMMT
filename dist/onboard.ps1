<#
  ───────────────────────────────────────────────────────────────────────────
  TMMT — plug-and-play onboarding (Windows). SELF-CONTAINED, no repo needed.
  Send this file to a teammate (e.g. the Dell XPS). They run it by:
    • right-click  onboard.ps1  →  "Run with PowerShell"
    • or:  powershell -ExecutionPolicy Bypass -File onboard.ps1
  Shows THE MISSION, requires acceptance, runs the interview, saves a profile
  they send back to you. No passwords, no installs, no internet required.
  ───────────────────────────────────────────────────────────────────────────
#>
$ErrorActionPreference = "Stop"
function B($t){ Write-Host $t -ForegroundColor White }
$PHRASE = "I ACCEPT THE MISSION"
function Norm($s){ ($s -replace "`r","").Trim().ToUpper() }

Clear-Host
B "================ TMMT - THE MISSION ================"
@"
  Movement: Trap Money Moves Timeless (TMMT) - for the people, by the people.

  Mission: Help everyday people get out and bring their family with them - with
  systems, automation, and AI agents (AIXMOS) to run a real business and grow,
  ONE STEP AT A TIME, without having to ask or beg anyone.

  How we operate:
   - Agents-first. AIXMOS does the heavy lifting; people make the calls that matter.
   - One step at a time.   - Protect the owner and the family. Always.
   - Only great, valuable information moves through the network.
   - Earn it, own it. Access is granted by the owner, scoped, revocable.

  The ask: become an agent of the mission. Use AIXMOS to do what you're here to
  do, leave it stronger than you found it, and never act against the owner/family.
"@ | Write-Host
Write-Host ""
B "You must accept the mission to continue."
$ack = Read-Host "Type exactly:  $PHRASE"
if ((Norm $ack) -ne (Norm $PHRASE)) { Write-Host "Mission not accepted. Onboarding stopped." -ForegroundColor Red; Read-Host "Press ENTER"; exit 1 }
Write-Host "[OK] Mission acknowledged." -ForegroundColor Green
Write-Host ""

$name = Read-Host "Full name / handle"
$role = (Read-Host "Role (operator | developer | vendor | teammate)").ToLower().Trim()
if ($role -notin @("operator","developer","vendor","teammate","owner")) { $role = "operator" }
$what  = Read-Host "In one line: what will you own / move forward for the mission?"
$skills= Read-Host "Your skills / tools (comma-separated)"
$step1 = Read-Host "Your FIRST step - the one move you will make next"
$consent = (Read-Host "Agree to UPHOLD THE OPERATOR STANDARDS (take work off the boss plate, do NOT blow up his phone, mission-first, honesty), keep everything confidential, least-privilege, never act against the owner/family? (yes/no)").ToLower().Trim()
if ($consent -notin @("y","yes")) { Write-Host "Onboarding requires agreement. Stopped." -ForegroundColor Red; Read-Host "Press ENTER"; exit 1 }

$slug = ($name.ToLower() -replace "[^a-z0-9]+","-").Trim("-"); if (-not $slug) { $slug = "me" }
$dest = [Environment]::GetFolderPath("Desktop"); if (-not $dest) { $dest = $env:USERPROFILE }
$f = Join-Path $dest "TMMT-onboarding-$slug.txt"
@"
TMMT ONBOARDING - $name
mission_accepted: YES ("$PHRASE")
at: $((Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"))
device: Windows - $env:COMPUTERNAME
role: $role
owns: $what
skills: $skills
first_step: $step1
agreed: yes
confidentiality_agreed: yes (keep how/why secret)
standards_agreed: yes (Operator Standards - phone rule, mission-first, honesty)
"@ | Set-Content -Path $f -Encoding UTF8

Clear-Host
Write-Host "[OK] Welcome, $name - you're in (pending the owner's grant)." -ForegroundColor Green
Write-Host ""
B "YOUR WORKFLOW:"
@"
  1. Mission accepted [x]
  2. You start in DEV (your sandbox) - you cannot break anything live.
  3. Your first step: $step1
  4. SECURE YOURSELF first: set up a password manager, unique passwords + MFA on
     email, bank, socials. The owner will send you the tools.
  5. Access is granted by X after he reviews this - one step at a time.
"@ | Write-Host
Write-Host ""
B "LAST STEP - send your profile back to X:"
Write-Host "  $f"
Write-Host "  (text/email that file to him so he can grant your access.)"
Write-Host ""
Read-Host "Press ENTER to close"
