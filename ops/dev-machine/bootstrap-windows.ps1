# First-time Windows setup: clone TMMT, Node 20, npm ci in tmmt-os.
param(
    [string]$TmmtRoot = "$env:USERPROFILE\dev\TMMT",
    [string]$GitRemote = "https://github.com/AIXMOS537/TMMT.git",
    [string]$GitBranch = "main",
    [ValidateSet("dev", "worker")]
    [string]$MachineRole = "worker"
)

$ErrorActionPreference = "Stop"

Write-Host "TMMT bootstrap (Windows) role=$MachineRole"
Write-Host "  clone:  $TmmtRoot"
Write-Host "  branch: $GitBranch"

$parent = Split-Path $TmmtRoot -Parent
if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }

if (-not (Test-Path "$TmmtRoot\.git")) {
    git clone --branch $GitBranch $GitRemote $TmmtRoot
} else {
    Write-Host "Already cloned at $TmmtRoot"
}

Set-Location $TmmtRoot
git fetch origin --prune
git checkout $GitBranch
git pull --ff-only origin $GitBranch

# Node 20 — fnm-windows or nvm-windows
if (Get-Command fnm -ErrorAction SilentlyContinue) {
    fnm install 20
    fnm use 20
} elseif (Get-Command nvm -ErrorAction SilentlyContinue) {
    nvm install 20
    nvm use 20.0.0
} else {
    Write-Warning "Install fnm or nvm-windows, then re-run."
}

if ($MachineRole -eq "dev") {
    if (Test-Path "tmmt-os\package-lock.json") {
        Set-Location tmmt-os
        npm ci
        Set-Location ..
    }
} else {
    Write-Host "Worker role: skipped npm ci (sync code only)."
}

Write-Host ""
Write-Host "Next:"
Write-Host "  1. Copy tmmt-os\.env.local if this box runs automations."
Write-Host "  2. Install Tailscale; join same tailnet."
Write-Host "  3. Hub only: .\ops\dev-machine\install-scheduled-task.ps1"
Write-Host "  4. Dev Mac: use Cursor on MacBook; push to GitHub."
