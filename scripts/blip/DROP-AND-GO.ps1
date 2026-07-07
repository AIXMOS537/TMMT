# DROP-AND-GO.ps1 — Windows one-click BLIP (AMD + Intel office PCs + BRAINIAC)
# Right-click → Run with PowerShell  OR  double-click GO.bat
$ErrorActionPreference = "Continue"
$Dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Dir

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  BLIP DROP-AND-GO — PROJECT X HAILMARY (Windows)             ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Step 0: High performance + never sleep on AC ──
Write-Host "=== Power profile (always-on forge) ===" -ForegroundColor Gray
powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
powercfg /change monitor-timeout-ac 15 2>$null
powercfg /change standby-timeout-ac 0 2>$null
powercfg /change hibernate-timeout-ac 0 2>$null

# ── Step 1: Tailscale ──
Write-Host "=== Tailscale ===" -ForegroundColor Gray
if (Get-Command tailscale -ErrorAction SilentlyContinue) {
  tailscale status | Select-Object -First 6
  Write-Host "  OK Tailscale" -ForegroundColor Green
} else {
  Write-Host "  ! Install: https://tailscale.com/download/windows" -ForegroundColor Yellow
  Write-Host "  Sign in: AIXMOS537 GitHub account" -ForegroundColor Yellow
}

# ── Step 2: Clone/find TMMT ──
$RepoPaths = @(
  "$env:USERPROFILE\projects\TMMT",
  "$env:USERPROFILE\Projects\TMMT",
  "$env:USERPROFILE\TMMT",
  "C:\hailmary\TMMT"
)
$Root = $null
foreach ($p in $RepoPaths) {
  if (Test-Path "$p\scripts\tmmt") { $Root = $p; break }
}
if (-not $Root) {
  Write-Host "=== Cloning TMMT ===" -ForegroundColor Gray
  $Root = "$env:USERPROFILE\projects\TMMT"
  New-Item -ItemType Directory -Force -Path (Split-Path $Root) | Out-Null
  git clone https://github.com/AIXMOS537/TMMT.git $Root
}
Write-Host "  TMMT: $Root" -ForegroundColor Green
Set-Location $Root

# ── Step 3: Detect role ──
$HostName = $env:COMPUTERNAME.ToLower()
$Role = "forge"
if ($HostName -match "brainiac") { $Role = "brain" }
elseif ($HostName -match "carry|watchtower") { $Role = "carry" }
Write-Host "  Role: $Role (hostname: $HostName)" -ForegroundColor Green

# ── Step 4: Office lock (employee-safe by default) ──
Write-Host "=== Office mode (employee protection) ===" -ForegroundColor Gray
$OfficeSh = "$Root\scripts\blip\office-mode.sh"
if (Get-Command bash -ErrorAction SilentlyContinue) {
  if ($HostName -match "brainiac|carry|watchtower") {
    bash $OfficeSh unlock 2>$null
  } else {
    bash $OfficeSh lock 2>$null
    bash $OfficeSh poll 2>$null
  }
} else {
  Write-Host "  Install Git Bash for office-mode.sh — default: locked" -ForegroundColor Yellow
}

# ── Step 5: X-FOREVER / LiteLLM on BRAINIAC ──
$XForever = @(
  "$env:USERPROFILE\Desktop\X-FOREVER\RUN-X-FOREVER.ps1",
  "$Dir\X-FOREVER\RUN-X-FOREVER.ps1",
  "C:\hailmary\X-FOREVER\RUN-X-FOREVER.ps1"
)
foreach ($xf in $XForever) {
  if (Test-Path $xf) {
    Write-Host "=== X-FOREVER stack ===" -ForegroundColor Gray
    & $xf
    break
  }
}

# BRAINIAC LiteLLM gateway
if ($Role -eq "brain") {
  $Gw = "C:\hailmary\brainiac-litellm-gateway"
  if (Test-Path "$Gw\docker-compose.yml") {
    Set-Location $Gw
    if (Test-Path ".\secrets-load.ps1") { & ".\secrets-load.ps1" }
    docker compose up -d
    Write-Host "  OK LiteLLM :4000" -ForegroundColor Green
  }
}

# ── Step 6: Docker AI-OPS if present ──
$OpsPaths = @("$env:USERPROFILE\projects\AI-OPS-STARTER", "$env:USERPROFILE\AI-OPS-STARTER", "C:\AI-OPS-STARTER")
foreach ($ops in $OpsPaths) {
  if (Test-Path "$ops\docker-compose.yml") {
    Set-Location $ops
    docker compose up -d 2>$null
    Write-Host "  OK AI-OPS-STARTER" -ForegroundColor Green
    break
  }
}

# ── Step 7: Mesh boot via Git Bash ──
Set-Location $Root
if (Get-Command bash -ErrorAction SilentlyContinue) {
  bash "$Root/scripts/blip/DROP-AND-GO.sh" $Role 2>&1 | Select-Object -Last 30
}

Write-Host ""
Write-Host "══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  DROP COMPLETE — Windows $Role" -ForegroundColor Green
Write-Host "══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Owner unlock (Taha in office):" -ForegroundColor Cyan
Write-Host "    bash scripts/blip/office-mode.sh unlock" -ForegroundColor White
Write-Host "  Lock for employees:" -ForegroundColor Cyan
Write-Host "    bash scripts/blip/office-mode.sh lock" -ForegroundColor White
Write-Host "  Carry broadcast to all devices:" -ForegroundColor Cyan
Write-Host "    bash scripts/blip/office-mode.sh broadcast" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to close"
