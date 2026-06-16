# go.ps1 — Windows plug-and-play. ONE command to update + boot the whole base.
# Requires Git for Windows (gives you `git` + `bash` from Git Bash on PATH).
# Run in PowerShell:
#   powershell -ExecutionPolicy Bypass -File scripts\go.ps1
# Or paste the one-liner from GO.md.
$ErrorActionPreference = "SilentlyContinue"
$Branch = if ($env:TMMT_BRANCH) { $env:TMMT_BRANCH } else { "claude/organize-chats-sessions-7t7zjy" }
$Repo   = if ($env:TMMT_REPO)   { $env:TMMT_REPO }   else { "https://github.com/AIXMOS537/TMMT.git" }

$cands = @("$HOME\Projects\TMMT","$HOME\projects\TMMT","$HOME\TMMT","$HOME\Documents\TMMT","$HOME\Desktop\TMMT")
$R = $cands | Where-Object { Test-Path "$_\.git" } | Select-Object -First 1
if (-not $R) {
  $R = "$HOME\TMMT"
  Write-Host "> No TMMT repo found - cloning into $R"
  git clone $Repo $R
}
Set-Location $R
Write-Host "> repo: $R"
git stash push -u -m "auto-stash by go" 2>$null
git fetch origin $Branch 2>$null
git checkout $Branch 2>$null
git pull origin $Branch
# The mesh scripts are bash; invoke via Git Bash's bash (on PATH after Git install).
bash scripts/tmmt unison
