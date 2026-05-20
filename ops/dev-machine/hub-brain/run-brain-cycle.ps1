# Runs one pass of TMMT Python automations (stdlib only).
param(
    [string]$TmmtRoot = "$env:USERPROFILE\dev\TMMT"
)

$ErrorActionPreference = "Stop"
$scripts = Join-Path $TmmtRoot "AUTOMATIONS\SCRIPTS"
$logs = Join-Path $TmmtRoot "AUTOMATIONS\LOGS"
if (-not (Test-Path $logs)) { New-Item -ItemType Directory -Path $logs -Force | Out-Null }

$py = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $py) { throw "python not found" }

$jobs = @(
    @{ Name = "daily_command_center"; File = "daily_command_center.py" },
    @{ Name = "customer_followup_reminders"; File = "customer_followup_reminders.py" },
    @{ Name = "maintenance_reminders"; File = "maintenance_reminders.py" }
)

foreach ($job in $jobs) {
    $path = Join-Path $scripts $job.File
    if (-not (Test-Path $path)) {
        Write-Warning "Skip $($job.Name): $path missing"
        continue
    }
    Write-Host ">> $($job.Name)"
    & $py $path 2>&1 | Tee-Object -FilePath (Join-Path $logs "$($job.Name)-$(Get-Date -Format yyyyMMdd).log") -Append
}

# Optional: push overdue to GHL when AUTOMATIONS/.env is configured
$overdue = Join-Path $scripts "push_overdue_to_ghl.py"
if (Test-Path $overdue) {
    Write-Host ">> push_overdue_to_ghl"
    & $py $overdue 2>&1 | Tee-Object -FilePath (Join-Path $logs "push_overdue-$(Get-Date -Format yyyyMMdd).log") -Append
}

Write-Host "Brain cycle done."
