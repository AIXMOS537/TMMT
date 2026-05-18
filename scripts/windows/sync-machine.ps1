# Sync local TMMT checkout with GitHub and refresh dependencies (Windows home PC).
# Run: C:\dev\TMMT\scripts\windows\sync-machine.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$BranchFile = Join-Path $RepoRoot "scripts\default-branch"
$Branch = if (Test-Path $BranchFile) { Get-Content $BranchFile -Raw } else { "main" }
$Branch = $Branch.Trim()
$OsDir = Join-Path $RepoRoot "tmmt-os"

Write-Host "==> TMMT sync @ $RepoRoot"
Set-Location $RepoRoot

$dirty = git status --porcelain
if ($dirty) {
    Write-Warning "Uncommitted changes. Commit or stash before pulling on another machine."
    git status -sb
}

git fetch origin
git pull --rebase origin $Branch

if (Test-Path (Join-Path $OsDir "package-lock.json")) {
    Write-Host "==> npm ci (tmmt-os)"
    Set-Location $OsDir
    if (Get-Command fnm -ErrorAction SilentlyContinue) {
        fnm use 2>$null; if ($LASTEXITCODE -ne 0) { fnm install }
    }
    npm ci
}

Set-Location $RepoRoot
Write-Host "==> Done. Branch: $(git branch --show-current)"
