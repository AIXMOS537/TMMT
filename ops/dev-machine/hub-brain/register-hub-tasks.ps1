# Register Windows scheduled tasks for 24/7 TMMT AI Brain hub.
param(
    [string]$TmmtRoot = "$env:USERPROFILE\dev\TMMT",
    [string]$AixRoot = "$env:USERPROFILE\dev\AIX-Command-Center",
    [string]$GitBranch = "main"
)

$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$repoOps = Resolve-Path (Join-Path $here "..")
$syncPs1 = Join-Path $repoOps "sync-windows.ps1"
$brainPs1 = Join-Path $here "run-brain-cycle.ps1"
$aixPy = Join-Path $AixRoot "AIX_AI_COMMAND_SYSTEM\aix_operator.py"
$chummoServe = Join-Path $AixRoot "ops\chummo-stack\serve.js"
$chummoDir = Join-Path $AixRoot "ops\chummo-stack"

function Register-TmmtTask {
    param(
        [string]$Name,
        [string]$Arguments,
        [object]$Trigger,
        [string]$WorkingDirectory = $TmmtRoot
    )
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $Arguments -WorkingDirectory $WorkingDirectory
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    Register-ScheduledTask -TaskName $Name -Action $action -Trigger $Trigger -Settings $settings -Force | Out-Null
    Write-Host "Registered: $Name"
}

# Git sync every 15 min
$repeat = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration ([TimeSpan]::MaxValue)
Register-TmmtTask -Name "TMMT-Hub-Sync" -Arguments @(
    "-NoProfile", "-ExecutionPolicy", "Bypass",
    "-File", "`"$syncPs1`"", "-TmmtRoot", "`"$TmmtRoot`"", "-GitBranch", $GitBranch, "-SyncMode", "code"
) -Trigger $repeat

# Daily command center 7:00 AM
$at7 = New-ScheduledTaskTrigger -Daily -At "7:00AM"
Register-TmmtTask -Name "TMMT-Daily-Command-Center" -Arguments @(
    "-NoProfile", "-ExecutionPolicy", "Bypass",
    "-File", "`"$brainPs1`"", "-TmmtRoot", "`"$TmmtRoot`""
) -Trigger $at7

# Follow-up + maintenance 9:00 AM (brain cycle runs all scripts)
$at9 = New-ScheduledTaskTrigger -Daily -At "9:00AM"
Register-TmmtTask -Name "TMMT-Brain-Cycle-AM" -Arguments @(
    "-NoProfile", "-ExecutionPolicy", "Bypass",
    "-File", "`"$brainPs1`"", "-TmmtRoot", "`"$TmmtRoot`""
) -Trigger $at9

# AIX morning operator (needs OPENAI_API_KEY in AIX .env)
if (Test-Path $aixPy) {
    $at730 = New-ScheduledTaskTrigger -Daily -At "7:30AM"
    Register-TmmtTask -Name "AIX-Morning-Operator" -Arguments @(
        "-NoProfile", "-ExecutionPolicy", "Bypass",
        "-Command", "cd `"$AixRoot\AIX_AI_COMMAND_SYSTEM`"; .\.venv\Scripts\python.exe aix_operator.py run morning"
    ) -Trigger $at730 -WorkingDirectory (Join-Path $AixRoot "AIX_AI_COMMAND_SYSTEM")
}

# CHUMMO local portal at logon (http://localhost:3000) — needs ANTHROPIC_API_KEY in user env
if ((Test-Path $chummoServe) -and (Get-Command node -ErrorAction SilentlyContinue)) {
    $logon = New-ScheduledTaskTrigger -AtLogOn
    $node = (Get-Command node).Source
    $action = New-ScheduledTaskAction -Execute $node -Argument "`"$chummoServe`"" -WorkingDirectory $chummoDir
    Register-ScheduledTask -TaskName "AIX-Chummo-Portal" -Action $action -Trigger $logon `
        -Settings (New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries) -Force | Out-Null
    Write-Host "Registered: AIX-Chummo-Portal (at logon)"
}

Write-Host ""
Write-Host "Hub tasks registered. Logs: $TmmtRoot\AUTOMATIONS\LOGS\"
