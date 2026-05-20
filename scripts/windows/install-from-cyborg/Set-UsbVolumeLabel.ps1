#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Label the USB drive to match config/manifest.json (default: CURSOR-SETUP).
#>
param(
    [Parameter(Mandatory)]
    [string]$DriveLetter,
    [string]$Label = 'CURSOR-SETUP'
)

$DriveLetter = $DriveLetter.TrimEnd(':').ToUpperInvariant()
Set-Volume -DriveLetter $DriveLetter -NewFileSystemLabel $Label
Write-Host "Volume $DriveLetter`: labeled as $Label"
