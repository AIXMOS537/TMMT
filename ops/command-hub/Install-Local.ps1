#Requires -Version 5.1
<#
.SYNOPSIS
  One-time install: copy TMMT OS + tools to C:\Users\AIXMOS\CommandCenter
  Run ONCE while APP USB (E:) is plugged in — after this, no USB needed.

  Muhammad Taha — CEO Mobile Command Center
#>

$ErrorActionPreference = 'Stop'

$root     = 'C:\Users\AIXMOS\CommandCenter'
$tmmtDest = Join-Path $root 'tmmt-os'
$logPath  = Join-Path $root 'install.log'
$desktop  = Join-Path $env:USERPROFILE 'Desktop'

$sources = @(
    'E:\TMMT MANAGEMENT\tmmt-os',
    'D:\TMMT MANAGEMENT\tmmt-os',
    (Join-Path $desktop 'tmmt-os')
)

function Log($msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
    Write-Host $line
    Add-Content -Path $logPath -Value $line -Encoding utf8
}

New-Item -ItemType Directory -Force -Path $root | Out-Null
"=== CEO Command Center install $(Get-Date) ===" | Out-File $logPath -Encoding utf8

# --- Find TMMT source ---
$src = $null
foreach ($s in $sources) {
    if (Test-Path (Join-Path $s 'package.json')) {
        $src = $s
        break
    }
}

if (-not $src) {
    Log 'ERROR: TMMT OS not found. Plug in APP USB (E:) or copy tmmt-os to Desktop first.'
    exit 1
}
Log "Source: $src"

# --- Copy app (robocopy: 0-7 = success) ---
Log "Copying to $tmmtDest ..."
New-Item -ItemType Directory -Force -Path $tmmtDest | Out-Null

$rcLog = Join-Path $root 'robocopy.log'
& robocopy $src $tmmtDest /E /XO /R:2 /W:2 /XD .next .git .vercel /NFL /NDL /NJH /NJS /nc /ns /np /LOG:$rcLog
$rc = $LASTEXITCODE
Log "robocopy exit: $rc"
if ($rc -ge 8) {
    Log 'ERROR: robocopy failed'
    exit $rc
}

# --- Env ---
$envSrc = Join-Path $src '.env.local'
if (Test-Path $envSrc) {
    Copy-Item -Force $envSrc (Join-Path $tmmtDest '.env.local')
    Log 'Copied .env.local'
} elseif (Test-Path (Join-Path $tmmtDest '.env.example')) {
    Copy-Item -Force (Join-Path $tmmtDest '.env.example') (Join-Path $tmmtDest '.env.local')
    Log 'Created .env.local from .env.example — fill in secrets if needed'
}

# --- Unblock ---
Get-ChildItem -Path $tmmtDest -Recurse -File -ErrorAction SilentlyContinue |
    ForEach-Object { Unblock-File -LiteralPath $_.FullName -ErrorAction SilentlyContinue }

# --- Node deps ---
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Log 'WARN: Node.js not installed — install LTS from https://nodejs.org then re-run this script'
    Write-Host 'Opening nodejs.org ...' -ForegroundColor Yellow
    Start-Process 'https://nodejs.org/'
} elseif (-not (Test-Path (Join-Path $tmmtDest 'node_modules\next'))) {
    Log "Node $(node -v) — running npm ci ..."
    Push-Location $tmmtDest
    npm ci 2>&1 | Tee-Object -FilePath (Join-Path $root 'npm-ci.log')
    Pop-Location
    Log 'npm ci done'
} else {
    Log 'node_modules present — skipped npm ci'
}

# --- Shortcuts manifest ---
$manifest = @"
CEO Mobile Command Center — installed $(Get-Date -Format 'yyyy-MM-dd HH:mm')
Owner: Muhammad Taha

LOCAL PATHS (no USB):
  App:     $tmmtDest
  Launcher: $desktop\START-CEO-COMMAND-CENTER.bat
  Log:     $logPath

QUICK LINKS (after starting):
  TMMT Dashboard:  http://localhost:3000
  Internal portal: http://localhost:3000/internal/dashboard
  Briefing:        http://localhost:3000/internal/briefing
  Dispatch:        http://localhost:3000/internal/dispatch
  Production:      https://tmmt-ops.vercel.app

START: Double-click START-CEO-COMMAND-CENTER.bat on Desktop
"@
$manifest | Out-File (Join-Path $root 'README.txt') -Encoding utf8
Copy-Item -Force (Join-Path $root 'README.txt') (Join-Path $desktop 'CEO-COMMAND-CENTER-README.txt')

Log 'Install complete'
Write-Host "`nDone. Unplug USB — use START-CEO-COMMAND-CENTER.bat" -ForegroundColor Green
