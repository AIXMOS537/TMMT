# =============================================================================
# setup-home-brain.ps1 — ONE SHOT, run ONCE on the home Windows brain (the $3k
# build, "brainiac-win"). A family member runs it a single time; from then on
# the OWNER can reach this PC from anywhere (mostly the carry M5) over
# Tailscale + SSH.
#
# It makes this PC: (1) joined to the owner's private tailnet (unattended, so it
# stays connected with nobody logged in), (2) SSH-able via Windows' built-in
# OpenSSH Server, (3) always-on (no sleep/hibernate), and the Tailscale service
# auto-starts on every boot. Nothing else — the owner does the rest remotely.
#
# HOW THE FAMILY MEMBER RUNS IT:
#   • Right-click this file -> "Run with PowerShell"  (it will self-elevate), OR
#   • In an elevated PowerShell:
#       powershell -ExecutionPolicy Bypass -File .\setup-home-brain.ps1
#   • Click "Yes" on the admin prompt.
#   • Paste the Tailscale setup key the owner sent, when asked.
#   • Wait for the green "ALL DONE" banner. Done — close the window.
#
# OWNER PREP (once, from anywhere, BEFORE sending the file):
#   1. Tailscale admin console -> Settings -> Keys -> Generate auth key
#      (Reusable). Copy it ("tskey-...").
#   2. Send the family member: THIS file + that key (revoke anytime).
#
# Safe to re-run. Standalone — needs NO git/GitHub login and NO repo.
# =============================================================================

$NodeName = "brainiac-win"

# --- Self-elevate to Administrator -------------------------------------------
$me = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($me)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Requesting administrator rights..." -ForegroundColor Yellow
    Start-Process powershell.exe "-ExecutionPolicy Bypass -NoProfile -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

function Step($m){ Write-Host "`n== $m ==" -ForegroundColor Cyan }
function Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m){ Write-Host "[!] $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "[X] $m" -ForegroundColor Red }

Step "Home Brain one-shot setup ($NodeName)"
Write-Host "This makes THIS PC reachable by the owner from anywhere. ~5-10 min."

# --- 1) Install Tailscale -----------------------------------------------------
Step "1) Install Tailscale"
$tsExe = "C:\Program Files\Tailscale\tailscale.exe"
if (-not (Test-Path $tsExe)) {
    $installed = $false
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "Installing via winget..."
        winget install --id Tailscale.Tailscale -e --silent --accept-source-agreements --accept-package-agreements
        if (Test-Path $tsExe) { $installed = $true }
    }
    if (-not $installed) {
        Write-Host "Downloading the Tailscale installer..."
        $msi = "$env:TEMP\tailscale-setup.exe"
        try {
            Invoke-WebRequest -Uri "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe" -OutFile $msi -UseBasicParsing
            Start-Process -FilePath $msi -ArgumentList "/quiet" -Wait
        } catch { Warn "Download/install failed: $($_.Exception.Message)" }
    }
}
if (Test-Path $tsExe) { Ok "Tailscale installed" } else { Fail "Tailscale not installed — get it from https://tailscale.com/download/windows, then re-run."; Read-Host "Press Enter to exit"; exit 1 }

# --- 2) Join the tailnet (unattended) ----------------------------------------
Step "2) Join the owner's tailnet"
$authKey = $env:TS_AUTHKEY
if (-not $authKey) {
    Write-Host "Paste the Tailscale setup key the owner sent (starts with 'tskey-'),"
    Write-Host "then press Enter. (Leave blank to use a login link instead.)"
    $authKey = Read-Host "Auth key"
}
# --unattended keeps it connected with no user logged in (true headless brain).
$tsArgs = @("up","--hostname=$NodeName","--accept-routes","--unattended")
if ($authKey) { $tsArgs += "--authkey=$authKey" }
& $tsExe @tsArgs
if ($LASTEXITCODE -eq 0) {
    Ok "Joined the tailnet as '$NodeName'"
} else {
    Warn "tailscale up returned $LASTEXITCODE. If no key was given, approve the login link that opened (owner, from your phone). If the key was expired/used, re-run with a fresh one."
}

# --- 3) Enable OpenSSH Server -------------------------------------------------
Step "3) Enable SSH (Windows OpenSSH Server)"
$cap = Get-WindowsCapability -Online | Where-Object { $_.Name -like "OpenSSH.Server*" } | Select-Object -First 1
if ($cap -and $cap.State -ne "Installed") {
    Write-Host "Installing OpenSSH Server feature..."
    Add-WindowsCapability -Online -Name $cap.Name | Out-Null
}
Set-Service -Name sshd -StartupType Automatic -ErrorAction SilentlyContinue
Start-Service sshd -ErrorAction SilentlyContinue
if ((Get-Service sshd -ErrorAction SilentlyContinue).Status -eq "Running") { Ok "OpenSSH Server running (auto-starts on boot)" } else { Warn "sshd not running — enable it via Settings -> System -> Optional features -> OpenSSH Server." }
# Firewall: ensure inbound 22 is allowed.
if (-not (Get-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -DisplayName "OpenSSH Server (sshd)" -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 -ErrorAction SilentlyContinue | Out-Null
}
Ok "Firewall allows SSH (port 22)"
# Make PowerShell the default SSH shell (nicer for the owner).
New-ItemProperty -Path "HKLM:\SOFTWARE\OpenSSH" -Name DefaultShell -Value "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -PropertyType String -Force -ErrorAction SilentlyContinue | Out-Null

# --- 4) Always-on (no sleep / no hibernate) ----------------------------------
Step "4) Always-on power settings"
powercfg /change standby-timeout-ac 0   2>$null; Ok "No standby on power"
powercfg /change hibernate-timeout-ac 0 2>$null
powercfg /change monitor-timeout-ac 0   2>$null
powercfg /hibernate off                 2>$null; Ok "Hibernate off"
Write-Host "  (BIOS-level: enable 'Restore on AC Power Loss' and 'Wake-on-LAN' for full auto-recovery — can't be scripted.)" -ForegroundColor DarkGray

# --- 5) Confirm + connection instructions ------------------------------------
Step "5) Confirm it's reachable"
Start-Sleep -Seconds 2
$tsIp = (& $tsExe ip -4 2>$null | Select-Object -First 1)
$who  = $env:USERNAME
Write-Host "`nALL DONE — this PC is now the always-on backup brain." -ForegroundColor Green
Write-Host "Tailscale auto-starts on every boot. You can close this window.`n"
Write-Host "--------------------------------------------------------------"
Write-Host " OWNER — from your carry M5 (or any device on your tailnet):"
Write-Host ""
Write-Host "   ssh $who@$NodeName"
if ($tsIp) { Write-Host "   ssh $who@$tsIp        # (this PC's tailnet IP)" }
Write-Host "--------------------------------------------------------------"
Write-Host ""
Write-Host "Node name : $NodeName"
Write-Host "Login user: $who"
if ($tsIp) { Write-Host "Tailnet IP: $tsIp" } else { Warn "No tailnet IP yet — if the join needed approval, finish it in the Tailscale admin console." }
Write-Host ""
Read-Host "Press Enter to close"
