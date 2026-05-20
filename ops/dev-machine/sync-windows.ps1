# Pull latest TMMT on Windows. Safe for Task Scheduler.
param(
    [string]$TmmtRoot = "$env:USERPROFILE\dev\TMMT",
    [string]$GitBranch = "main",
    [ValidateSet("code", "dev")]
    [string]$SyncMode = "code"
)

$ErrorActionPreference = "Stop"
$logDir = Join-Path $env:USERPROFILE "Logs\tmmt-sync"
$lockFile = Join-Path $env:TEMP "tmmt-sync.lock"

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logFile = Join-Path $logDir ("sync-{0:yyyyMMdd}.log" -f (Get-Date))

function Log($msg) {
    $line = "{0} {1}" -f (Get-Date -Format "o"), $msg
    Add-Content -Path $logFile -Value $line
    Write-Host $line
}

if (Test-Path $lockFile) {
    Log "Another sync running; exit."
    exit 0
}
New-Item -ItemType File -Path $lockFile -Force | Out-Null
try {
    Log "=== sync-windows ($SyncMode) ==="

    if (-not (Test-Path "$TmmtRoot\.git")) {
        Log "ERROR: $TmmtRoot is not a git clone."
        exit 1
    }

    Set-Location $TmmtRoot
    git fetch origin --prune
    git checkout $GitBranch
    git pull --ff-only origin $GitBranch

    if ($SyncMode -eq "dev") {
        if (Get-Command fnm -ErrorAction SilentlyContinue) { fnm use 20 2>$null }
        if (Test-Path "tmmt-os\package-lock.json") {
            Set-Location tmmt-os
            npm ci
        }
    }

    $hash = git rev-parse --short HEAD
    Log "OK: $hash on $GitBranch"
} finally {
    Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
}
