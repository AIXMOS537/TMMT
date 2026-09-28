#Requires -Version 5.1
<#
  CEO Mobile Command Center — Muhammad Taha
  Fully local. No USB required after one-time install.
#>

$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = 'CEO Command Center — Muhammad Taha'

$root     = 'C:\Users\AIXMOS\CommandCenter'
$tmmtRoot = Join-Path $root 'tmmt-os'
$logPath  = Join-Path $root 'session.log'
$prodUrl  = 'https://tmmt-ops.vercel.app'

function Log($msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
    Add-Content -Path $logPath -Value $line -Encoding utf8 -ErrorAction SilentlyContinue
}

function Test-TmmtReady {
    return (Test-Path (Join-Path $tmmtRoot 'package.json'))
}

function Test-NodeReady {
    return [bool](Get-Command node -ErrorAction SilentlyContinue)
}

function Test-DevServer {
    try {
        $r = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        return $true
    } catch { return $false }
}

function Start-TmmtDev {
    if (-not (Test-TmmtReady)) {
        Write-Host 'TMMT not installed locally.' -ForegroundColor Red
        Write-Host 'Run once: Desktop\INSTALL-COMMAND-CENTER-ONCE.bat (USB plugged in)' -ForegroundColor Yellow
        Read-Host 'Press Enter'
        return
    }
    if (-not (Test-NodeReady)) {
        Start-Process 'https://nodejs.org/'
        Read-Host 'Install Node.js LTS, then press Enter'
        return
    }
    if (Test-DevServer) {
        Start-Process 'http://localhost:3000'
        Write-Host 'Dev server already running.' -ForegroundColor Green
        Read-Host 'Press Enter'
        return
    }
    Set-Location $tmmtRoot
    if (-not (Test-Path 'node_modules\next')) {
        Write-Host 'Installing dependencies...' -ForegroundColor Yellow
        npm ci
    }
    Log 'Starting TMMT dev server'
    Start-Process powershell -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-NoExit', '-Command',
        "Set-Location '$tmmtRoot'; Write-Host 'CEO Command Center — http://localhost:3000' -ForegroundColor Cyan; npm run dev"
    )
    Start-Sleep -Seconds 4
    Start-Process 'http://localhost:3000/internal/briefing'
    Read-Host 'Press Enter'
}

function Open-Link($url, $label) {
    Log "Open $label : $url"
    Start-Process $url
}

function Open-Cursor {
    $paths = @(
        "$env:LOCALAPPDATA\Programs\cursor\Cursor.exe",
        "$env:ProgramFiles\Cursor\Cursor.exe"
    )
    $exe = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($exe) { Start-Process $exe } else { Write-Host 'Cursor not found' -ForegroundColor Yellow }
    Read-Host 'Press Enter'
}

function Show-Header {
    Clear-Host
    $ready = Test-TmmtReady
    $node  = Test-NodeReady
    $live  = Test-DevServer
    Write-Host @"

 ╔══════════════════════════════════════════════════════════════╗
 ║     CEO MOBILE COMMAND CENTER                                ║
 ║     Muhammad Taha                                            ║
 ╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan
    Write-Host "  Local TMMT: $(if ($ready) { 'READY' } else { 'NOT INSTALLED — run INSTALL-COMMAND-CENTER-ONCE.bat' })" `
        -ForegroundColor $(if ($ready) { 'Green' } else { 'Red' })
    Write-Host "  Node.js:    $(if ($node) { (& node -v) } else { 'missing' })" `
        -ForegroundColor $(if ($node) { 'Green' } else { 'Yellow' })
    Write-Host "  Dev server: $(if ($live) { 'RUNNING :3000' } else { 'stopped' })" `
        -ForegroundColor $(if ($live) { 'Green' } else { 'DarkGray' })
    Write-Host "  USB:        not required`n" -ForegroundColor DarkGray
}

Log 'CEO Command Center opened'

while ($true) {
    Show-Header
    Write-Host "  LAUNCH" -ForegroundColor Yellow
    Write-Host "    [1] Start TMMT OS (local dashboard)"
    Write-Host "    [2] Open production ops  ($prodUrl)"
    Write-Host "    [3] Internal briefing    (/internal/briefing)"
    Write-Host "    [4] Dispatch center      (/internal/dispatch)"
    Write-Host "    [5] Cases pipeline       (/internal/cases)"
    Write-Host "    [6] Operator / agency    (/internal/agency)"
    Write-Host "    [7] Marketplace          (/internal/marketplace)"
    Write-Host ""
    Write-Host "  TOOLS" -ForegroundColor Yellow
    Write-Host "    [C] Open Cursor IDE (AI agents)"
    Write-Host "    [I] One-time local install (if TMMT not copied yet)"
    Write-Host "    [R] Refresh"
    Write-Host "    [Q] Quit"
    Write-Host ""

    $base = if (Test-DevServer) { 'http://localhost:3000' } else { $prodUrl }
    $c = Read-Host 'Choice'

    switch ($c.ToUpperInvariant()) {
        '1'  { Start-TmmtDev }
        '2'  { Open-Link $prodUrl 'production' }
        '3'  { Open-Link "$base/internal/briefing" 'briefing'; Read-Host 'Press Enter' }
        '4'  { Open-Link "$base/internal/dispatch" 'dispatch'; Read-Host 'Press Enter' }
        '5'  { Open-Link "$base/internal/cases" 'cases'; Read-Host 'Press Enter' }
        '6'  { Open-Link "$base/internal/agency" 'agency'; Read-Host 'Press Enter' }
        '7'  { Open-Link "$base/internal/marketplace" 'marketplace'; Read-Host 'Press Enter' }
        'C'  { Open-Cursor }
        'I'  {
            $bat = Join-Path $env:USERPROFILE 'Desktop\INSTALL-COMMAND-CENTER-ONCE.bat'
            if (Test-Path $bat) { Start-Process $bat -Wait } else { Write-Host 'Installer not found' -ForegroundColor Red; Read-Host 'Press Enter' }
        }
        'R'  { continue }
        'Q'  { Log 'Session ended'; break }
        default { Start-Sleep 1 }
    }
    if ($c.ToUpperInvariant() -eq 'Q') { break }
}
