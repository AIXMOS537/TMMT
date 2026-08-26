<#
  ops sync — mirror the tablet's work onto every attached flashdrive.

    ops sync            copy to every drive carrying a TMMT-WORK folder
    ops sync -List      show what would happen, copy nothing
    ops sync -Drive F   just one drive

  Follows the lane convention already written on the sticks
  (_TABLET-SYNC-INFO.txt):

    TMMT-WORK\     business work  (CommandCenter, TMMT-canon, TMMT-TEAM-DRIVE)
    AIXMOS-BRAIN\  the private brain
    PERSONAL\      Downloads, Documents, Desktop

  ADDITIVE, NOT MIRRORED. robocopy /E copies and overwrites but never deletes.
  /MIR would make the stick match the tablet exactly — and would also delete
  anything on the stick the tablet no longer has. On drives that carry private
  family material and are the offline backup of last resort, silently deleting
  is the one failure worth engineering out. Stale files on a backup cost space;
  a purged one costs the file.
#>

param(
  [Parameter(Position = 0)][string]$Mode = '',
  [switch]$List,
  [string]$Drive
)

# `ops sync list` rather than `ops sync -List`: ops.ps1 declares its own
# ValueFromRemainingArguments parameter, and its binder swallows a leading
# -Flag before it ever reaches this script. A bare word survives the trip.
if ($Mode -match '^(list|dry|preview|-?list)$') { $List = $true }
elseif ($Mode -match '^[D-Zd-z]:?$')            { $Drive = $Mode }

$ErrorActionPreference = 'SilentlyContinue'

function Hd($t)  { Write-Host ''; Write-Host "  $t" -ForegroundColor Cyan; Write-Host "  $('-' * $t.Length)" -ForegroundColor DarkGray }
function Ok($t)  { Write-Host "  [ OK ] " -ForegroundColor Green -NoNewline; Write-Host $t }
function Warn($t){ Write-Host "  [warn] " -ForegroundColor Yellow -NoNewline; Write-Host $t }
function Step($t){ Write-Host "  [--] $t" -ForegroundColor DarkGray }

# source -> destination lane, relative to the drive root
$LANES = @(
  @{ Src = 'C:\Users\AIXMOS\TMMT-canon';    Dest = 'TMMT-WORK\TMMT-canon';    Name = 'TMMT canon repo' },
  @{ Src = 'C:\Users\AIXMOS\CommandCenter'; Dest = 'TMMT-WORK\CommandCenter'; Name = 'Command Center + ops' },
  @{ Src = 'C:\Users\AIXMOS\AIXMOS-Brain';  Dest = 'AIXMOS-BRAIN';            Name = 'Brain (private)' }
)

# Build caches and run artifacts. Restore with `npm ci`, never worth the copy
# time or the FAT32 file-count churn.
$EXCLUDE_DIRS = @(
  'node_modules', '.next', '.turbo', 'dist', 'build',
  'audit', 'test-results', 'playwright-report', 'Snapshots',
  '.vercel', '$RECYCLE.BIN', '_QUARANTINE-2026-08-25'
)

# Two things bite here, both silently:
#   - `Test-Path A -or Test-Path B` binds -or to Test-Path's arguments, so the
#     parentheses below are load-bearing.
#   - Windows PowerShell 5.1 will not accept a comment between a trailing `|`
#     and the next stage of a pipeline, so this note lives above the statement.
# Deliberately does NOT filter on DriveType. Get-Volume surfaces it as a string
# under PowerShell 7 and an enum under Windows PowerShell 5.1, so `-eq
# 'Removable'` matches three drives in one and none in the other — and ops.ps1
# is launched by 5.1. Carrying a TMMT-WORK or AIXMOS-BRAIN folder is the real
# signal anyway: it says the stick is one of ours, which is what we mean.
$targets = Get-Volume |
  Where-Object { $_.DriveLetter -and "$($_.DriveLetter)" -ne 'C' } |
  Where-Object { (Test-Path "$($_.DriveLetter):\TMMT-WORK") -or (Test-Path "$($_.DriveLetter):\AIXMOS-BRAIN") }

if ($Drive) { $targets = $targets | Where-Object { $_.DriveLetter -eq $Drive.TrimEnd(':') } }

Hd 'FLASHDRIVE SYNC'
if (-not $targets) { Warn 'No flashdrive with a TMMT-WORK or AIXMOS-BRAIN folder is attached.'; Write-Host ''; return }

foreach ($t in $targets) {
  $letter = $t.DriveLetter
  Write-Host ''
  Write-Host "  $letter`: $($t.FileSystemLabel)  [$($t.FileSystem)]  $([math]::Round($t.SizeRemaining/1GB,1)) GB free" -ForegroundColor White

  foreach ($lane in $LANES) {
    if (-not (Test-Path $lane.Src)) { Warn "$($lane.Name) - source missing, skipped"; continue }
    $dest = Join-Path "$letter`:" $lane.Dest

    if ($List) { Step "$($lane.Name)  ->  $dest"; continue }

    Step "$($lane.Name) ..."
    $xd = @()
    foreach ($d in $EXCLUDE_DIRS) { $xd += '/XD'; $xd += $d }

    # /E copy subdirs incl. empty · /XO skip older source · /R:1 /W:1 don't hang
    # on a locked file · /NFL /NDL quiet, we only want the summary.
    $out = & robocopy $lane.Src $dest /E /XO /R:1 /W:1 /NFL /NDL /NJH /NJS @xd 2>&1
    $code = $LASTEXITCODE

    # robocopy exit codes: 0 nothing to do, 1-3 files copied, >=8 real failure.
    if ($code -ge 8) { Warn "$($lane.Name) - robocopy reported errors (code $code)" }
    elseif ($code -eq 0) { Ok "$($lane.Name) - already current" }
    else { Ok "$($lane.Name) - updated" }
  }

  if (-not $List) {
    $stamp = @"
TABLET FULL MIRROR  (auto-generated)
Last sync : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Drive     : $letter`:\
Lanes     :
  TMMT-WORK\     = business work  (CommandCenter, TMMT-canon, TMMT-TEAM-DRIVE)
  AIXMOS-BRAIN\  = private Obsidian brain (family/personal) -- keep this drive private
  PERSONAL\      = Downloads, Documents, Desktop
Excluded  : node_modules, .next, build caches  ->  run 'npm ci' to restore them
Mode      : additive copy (ops sync). Files removed on the tablet are NOT deleted here.
NOTE      : this drive contains PRIVATE family/personal data (brain). Do not leave it at the shop.
"@
    Set-Content -Path "$letter`:\_TABLET-SYNC-INFO.txt" -Value $stamp -Encoding UTF8
  }
}

Write-Host ''
if ($List) { Write-Host '  Nothing was copied. Drop -List to run it.' -ForegroundColor DarkGray }
else       { Write-Host '  All attached drives updated.' -ForegroundColor Green }
Write-Host ''
