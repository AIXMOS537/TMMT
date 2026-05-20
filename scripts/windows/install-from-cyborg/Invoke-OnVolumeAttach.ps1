# Triggered by scheduled task — starts setup only when labeled USB is present
$ErrorActionPreference = 'SilentlyContinue'

$kitRoot = [Environment]::GetEnvironmentVariable('USB_SETUP_KIT_PATH', 'User')
if (-not $kitRoot) {
    $kitRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
}

$manifestPath = Join-Path $kitRoot 'config\manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath)) { exit 0 }

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$label = $manifest.volumeLabel
if (-not $label) { exit 0 }

Start-Sleep -Seconds 2

$vol = Get-Volume | Where-Object {
    $_.DriveType -eq 'Removable' -and
    $_.FileSystemLabel -eq $label -and
    $_.DriveLetter
} | Select-Object -First 1

if (-not $vol) { exit 0 }

$driveRoot = '{0}:\' -f $vol.DriveLetter
$candidates = @(
    (Join-Path $driveRoot 'START-AGENTS.bat'),
    (Join-Path $driveRoot 'install\RUN-AGENTS.bat'),
    (Join-Path $driveRoot 'START-SETUP.bat')
)

$launcher = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $launcher) { exit 0 }

$env:USB_SETUP_ROOT = $driveRoot.TrimEnd('\')
if ($launcher -like '*\install\*') {
    $env:USB_SETUP_ROOT = Split-Path -Parent (Split-Path -Parent $launcher)
}

# Silent agents run (no pause) for plug-and-play insert
if ($launcher -like '*RUN-AGENTS.bat' -or $launcher -like '*START-AGENTS.bat') {
    $ps1 = Join-Path $env:USB_SETUP_ROOT 'install\Run-Agents-PlugAndPlay.ps1'
    if (Test-Path -LiteralPath $ps1) {
        Start-Process -FilePath 'powershell.exe' -ArgumentList @(
            '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Normal',
            '-File', $ps1, '-Quiet'
        ) -WindowStyle Normal
        exit 0
    }
}

Start-Process -FilePath $launcher -WindowStyle Normal
