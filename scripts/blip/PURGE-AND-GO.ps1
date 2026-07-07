# PURGE-AND-GO.ps1 — Windows factory fresh (AMD/Intel/BRAINIAC)
$ErrorActionPreference = "Continue"
$Dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Archive = "$env:USERPROFILE\.config\tmmt\purged-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  PURGE + GO — Windows factory fresh                          ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path $Archive | Out-Null

# Stop stale containers (keep nothing running — fresh start)
Write-Host "=== Stopping old Docker stacks ===" -ForegroundColor Gray
if (Get-Command docker -ErrorAction SilentlyContinue) {
  docker ps -q 2>$null | ForEach-Object { docker stop $_ 2>$null }
  Write-Host "  OK Docker containers stopped" -ForegroundColor Green
}

# Clean temp
Remove-Item "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue

# Archive stale config (never delete master secrets if present)
$Cfg = "$env:USERPROFILE\.config\tmmt"
if (Test-Path $Cfg) {
  New-Item -ItemType Directory -Force -Path "$Archive\tmmt-config" | Out-Null
  Get-ChildItem $Cfg -File | Where-Object {
    $_.Name -notmatch 'litellm-master|owner-only|office-unlock|rick\.env|access-tiers|sovereign'
  } | ForEach-Object {
    Move-Item $_.FullName "$Archive\tmmt-config\" -Force -ErrorAction SilentlyContinue
  }
}

# High performance
powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
powercfg /change standby-timeout-ac 0 2>$null

Write-Host "=== Fresh install ===" -ForegroundColor Gray
& "$Dir\DROP-AND-GO.ps1"

Write-Host ""
Write-Host "PURGE COMPLETE — Windows clean stack" -ForegroundColor Green
