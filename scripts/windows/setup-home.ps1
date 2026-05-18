# One-time Windows home PC bootstrap for TMMT dual-machine workflow.
# Run in PowerShell (Admin optional for fnm/winget only).

$ErrorActionPreference = "Stop"
$DevRoot = "C:\dev"
$RepoUrl = "https://github.com/AIXMOS537/TMMT.git"
$BranchFile = "scripts\default-branch"

Write-Host "==> Creating $DevRoot"
New-Item -ItemType Directory -Force -Path $DevRoot | Out-Null
Set-Location $DevRoot

if (-not (Test-Path ".\TMMT\.git")) {
    Write-Host "==> Cloning TMMT"
    git clone $RepoUrl TMMT
}

Set-Location "$DevRoot\TMMT"
$Branch = (Get-Content $BranchFile -Raw).Trim()
git fetch origin
git checkout $Branch 2>$null
if ($LASTEXITCODE -ne 0) { git checkout -b $Branch "origin/$Branch" }
git pull --rebase origin $Branch

Write-Host @"

Next steps (manual):
1. Install Node 20: winget install CoreyButler.NVMforWindows  OR  winget install Schniz.fnm
2. Install Git: winget install Git.Git
3. Install Cursor: https://cursor.com
4. Copy tmmt-os\.env.local from 1Password (same Supabase project as office)
5. Run: C:\dev\TMMT\scripts\windows\sync-machine.ps1
6. Install Tailscale, sign in on both machines
7. Generate SSH key: ssh-keygen -t ed25519 -C "home-windows"
   Add public key to office Mac ~/.ssh/authorized_keys

Open repo in Cursor: C:\dev\TMMT

"@
