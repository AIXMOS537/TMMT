# Phase 9 — Cloudflare quick-tunnel installer (TEMPLATE, not currently usable).
#
# DO NOT RUN as-is. Per memory [[imessage-relay-live]], the iMessage relay is intentionally
# manual-only on the work Mac (M1 Max), not on BRAINIAC. The carry Mac (M5 Pro / 100.77.126.8)
# is archived. To use this script you would need to:
#   1. Install the relay on the work Mac (CYBORG bundle).
#   2. Decide whether the relay runs 24/7 (current design is manual on/off).
#   3. Change the --url flag below from http://localhost:8787 to the work Mac's tailnet IP:port.
#
# When all three are true, run on BRAINIAC (Windows) in an elevated PowerShell:
#   1. Installs cloudflared via winget if absent.
#   2. Probes the configured URL to confirm the relay is up (warns + continues if not).
#   3. Opens an ephemeral quick tunnel.
#   4. Prints the trycloudflare.com URL once it appears.
#
# For a persistent URL (recommended for production), see "Upgrading to a named tunnel" in README.md.

$ErrorActionPreference = "Stop"

Write-Host "[phase9-tunnel] checking cloudflared..." -ForegroundColor Cyan
$cf = Get-Command cloudflared -ErrorAction SilentlyContinue

if (-not $cf) {
    Write-Host "[phase9-tunnel] cloudflared not found — installing via winget..." -ForegroundColor Yellow
    try {
        winget install --id Cloudflare.cloudflared --silent --accept-package-agreements --accept-source-agreements
    } catch {
        Write-Host "[phase9-tunnel] winget failed. Manual install: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" -ForegroundColor Red
        exit 1
    }
    # Refresh PATH for this session
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
    $cf = Get-Command cloudflared -ErrorAction SilentlyContinue
    if (-not $cf) {
        Write-Host "[phase9-tunnel] cloudflared still not on PATH after install. Reopen PowerShell and re-run, or add manually." -ForegroundColor Red
        exit 1
    }
}

Write-Host "[phase9-tunnel] cloudflared version:" -ForegroundColor Cyan
cloudflared --version

# Sanity check: is the iMessage relay actually listening?
Write-Host "[phase9-tunnel] probing http://localhost:8787 ..." -ForegroundColor Cyan
try {
    $probe = Invoke-WebRequest -Uri "http://localhost:8787/" -Method GET -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    Write-Host "[phase9-tunnel] relay responded $($probe.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "[phase9-tunnel] WARN: relay at localhost:8787 did not respond. Check the launchd plist (see project_imessage_relay_live memory) before continuing." -ForegroundColor Yellow
    Write-Host "[phase9-tunnel] continuing anyway — tunnel will simply 502 until the relay is up." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[phase9-tunnel] starting ephemeral quick tunnel..." -ForegroundColor Cyan
Write-Host "[phase9-tunnel] watch for 'https://<something>.trycloudflare.com' below — that's the URL you need." -ForegroundColor Cyan
Write-Host "[phase9-tunnel] keep this window open. Ctrl-C stops the tunnel." -ForegroundColor Cyan
Write-Host ""

# Run in foreground so the URL is visible and the tunnel stays up.
cloudflared tunnel --url http://localhost:8787 --loglevel info
