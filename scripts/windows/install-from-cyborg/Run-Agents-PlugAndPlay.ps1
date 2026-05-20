#Requires -Version 5.1
[CmdletBinding()]
param([switch]$Quiet)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$kitRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$env:USB_SETUP_ROOT = $kitRoot

. (Join-Path $kitRoot 'lib\Setup-Common.ps1')

$manifestPath = Join-Path $kitRoot 'config\manifest.json'
$settingsPath = Join-Path $kitRoot 'config\settings.json'
$manifest = Read-JsonFile -Path $manifestPath
$settings = if (Test-Path -LiteralPath $settingsPath) {
    Read-JsonFile -Path $settingsPath
} else { [pscustomobject]@{} }

Initialize-SetupLog -KitRoot $kitRoot -LogToUsb $true

Write-Host '=== Agents plug-and-play ===' -ForegroundColor Green
Write-Host "Kit: $kitRoot"

if ($settings.plugAndPlay -and [bool]$settings.plugAndPlay.setExecutionPolicy) {
    Ensure-UserCanRunScripts
}
if ($settings.plugAndPlay -and [bool]$settings.plugAndPlay.unblockUsbFiles) {
    Unblock-KitTree -KitRoot $kitRoot
}

$context = @{ KitRoot = $kitRoot; Manifest = $manifest; Settings = $settings; Force = $true; Auto = $true }

$phaseIds = @('preflight', 'agents', 'postflight')
if ($manifest.plugAndPlay -and $manifest.plugAndPlay.phasesWhenAuto) {
    $phaseIds = @($manifest.plugAndPlay.phasesWhenAuto)
}

$failed = $false
foreach ($phaseId in $phaseIds) {
    $p = @($manifest.phases | Where-Object { $_.id -eq $phaseId }) | Select-Object -First 1
    if (-not $p) { continue }
    Write-Host "`n---- $($p.name) ----" -ForegroundColor Cyan
    $folder = Join-Path $kitRoot $p.folder
    foreach ($scriptName in @($p.scripts)) {
        $outcome = Invoke-SetupScript -ScriptPath (Join-Path $folder $scriptName) -Context $context
        if (-not $outcome.Success -and -not $outcome.Skipped) { $failed = $true }
    }
}

if (Test-AppsPhaseHasInstallers -KitRoot $kitRoot) {
    Write-Host ''
    Write-Host '---- Applications ----' -ForegroundColor Cyan
    $apps = @($manifest.phases | Where-Object { $_.id -eq 'apps' }) | Select-Object -First 1
    if ($apps) {
        $folder = Join-Path $kitRoot $apps.folder
        foreach ($scriptName in @($apps.scripts)) {
            $outcome = Invoke-SetupScript -ScriptPath (Join-Path $folder $scriptName) -Context $context
            if (-not $outcome.Success -and -not $outcome.Skipped) { $failed = $true }
        }
    }
}

if ($failed) {
    Write-SetupLog 'Agents setup finished with errors.' 'ERROR'
    exit 1
}
Write-SetupLog 'Agents setup completed.' 'OK'
Write-Host 'Reload Cursor: Ctrl+Shift+P -> Developer: Reload Window' -ForegroundColor Green
exit 0
