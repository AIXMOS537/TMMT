# Register Windows Task Scheduler job: TMMT git pull every 15 minutes (24/7 home PC).
param(
    [string]$TmmtRoot = "$env:USERPROFILE\dev\TMMT",
    [string]$GitBranch = "main",
    [ValidateSet("code", "dev")]
    [string]$SyncMode = "code",
    [string]$TaskName = "TMMT-Sync"
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$syncScript = Join-Path $repoRoot "ops\dev-machine\sync-windows.ps1"

if (-not (Test-Path $syncScript)) {
    throw "Run from repo after clone: $syncScript not found"
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument @(
    "-NoProfile", "-ExecutionPolicy", "Bypass",
    "-File", "`"$syncScript`"",
    "-TmmtRoot", "`"$TmmtRoot`"",
    "-GitBranch", $GitBranch,
    "-SyncMode", $SyncMode
)

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration ([TimeSpan]::MaxValue)

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

Write-Host "Registered scheduled task: $TaskName"
Write-Host "  Script: $syncScript"
Write-Host "  Root:   $TmmtRoot"
Write-Host "  Mode:   $SyncMode"
Write-Host "  Logs:   $env:USERPROFILE\Logs\tmmt-sync\"
