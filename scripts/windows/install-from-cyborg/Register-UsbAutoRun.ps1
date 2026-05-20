#Requires -RunAsAdministrator
<#
.SYNOPSIS
    One-time host setup: launch USB setup when removable media is configured.
.NOTES
    Windows blocks autorun.exe on USB. This registers a Scheduled Task on PnP events;
    Invoke-OnVolumeAttach.ps1 filters by volume label from manifest.json.
#>
[CmdletBinding()]
param(
    [string]$KitRoot,
    [string]$VolumeLabel,
    [switch]$Unregister
)

$ErrorActionPreference = 'Stop'

if (-not $KitRoot) {
    if ($env:USB_SETUP_ROOT) { $KitRoot = $env:USB_SETUP_ROOT }
    else { $KitRoot = Split-Path -Parent $PSScriptRoot }
}

. (Join-Path $KitRoot 'lib\Setup-Common.ps1')

$manifest = Read-JsonFile -Path (Join-Path $KitRoot 'config\manifest.json')
if (-not $VolumeLabel) { $VolumeLabel = $manifest.volumeLabel }

$taskName = 'USB-SetupKit-AutoRun'
$invokeScript = Join-Path $KitRoot 'install\Invoke-OnVolumeAttach.ps1'

if ($Unregister) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Removed scheduled task: $taskName"
    exit 0
}

if (-not (Test-Path -LiteralPath $invokeScript)) {
    throw "Missing: $invokeScript"
}

# Marker for troubleshooting (trigger resolves drive by volume label, not this path)
[Environment]::SetEnvironmentVariable('USB_SETUP_KIT_REGISTERED', (Get-Date -Format 'o'), 'User')
[Environment]::SetEnvironmentVariable('USB_SETUP_KIT_PATH', $KitRoot, 'User')

$xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>USB Setup Kit — volume label: $VolumeLabel</Description>
  </RegistrationInfo>
  <Triggers>
    <EventTrigger>
      <Enabled>true</Enabled>
      <Subscription>&lt;QueryList&gt;&lt;Query Id="0" Path="Microsoft-Windows-Kernel-PnP/Configuration"&gt;&lt;Select Path="Microsoft-Windows-Kernel-PnP/Configuration"&gt;*[System[Provider[@Name='Microsoft-Windows-Kernel-PnP'] and EventID=410]]&lt;/Select&gt;&lt;/Query&gt;&lt;/QueryList&gt;</Subscription>
    </EventTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT5M</ExecutionTimeLimit>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$invokeScript"</Arguments>
    </Exec>
  </Actions>
</Task>
"@

$tempXml = Join-Path $env:TEMP 'usb-setup-task.xml'
[System.IO.File]::WriteAllText($tempXml, $xml, [System.Text.Encoding]::Unicode)
Register-ScheduledTask -TaskName $taskName -Xml (Get-Content -LiteralPath $tempXml -Raw) -Force | Out-Null
Remove-Item -LiteralPath $tempXml -Force -ErrorAction SilentlyContinue

Write-Host "Registered: $taskName"
Write-Host "Volume label filter: $VolumeLabel"
Write-Host "Registered from kit at: $KitRoot"
Write-Host 'Unregister: .\install\Register-UsbAutoRun.ps1 -Unregister'
