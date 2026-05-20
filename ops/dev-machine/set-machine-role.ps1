# Quick helper: bootstrap with the right role for this Windows box.
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("hub", "worker", "dev")]
    [string]$Role
)

$TmmtRoot = "$env:USERPROFILE\dev\TMMT"
$here = $PSScriptRoot

switch ($Role) {
    "hub" {
        & "$here\bootstrap-windows.ps1" -TmmtRoot $TmmtRoot -MachineRole "worker"
        & "$here\install-scheduled-task.ps1" -TmmtRoot $TmmtRoot -SyncMode "code" -TaskName "TMMT-Hub-Sync"
        Write-Host "Hub ready: code sync every 15 min. Add automations + Tailscale separately."
    }
    "worker" {
        & "$here\bootstrap-windows.ps1" -TmmtRoot $TmmtRoot -MachineRole "worker"
        & "$here\install-scheduled-task.ps1" -TmmtRoot $TmmtRoot -SyncMode "code" -TaskName "TMMT-Worker-Sync"
    }
    "dev" {
        & "$here\bootstrap-windows.ps1" -TmmtRoot $TmmtRoot -MachineRole "dev"
        Write-Host "Windows dev box: npm ci done. Use MacBook for Cursor when possible."
    }
}
