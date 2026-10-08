<#
  ops device — what is this machine allowed to run?

      ops device          the verdict, plus what is running that should not be
      ops device fix      turn off what this tier should not be running

  One rule across the fleet: heavy runtimes live on capable machines, and every
  other device reaches them over Tailscale instead of running its own.

  CORES DECIDE THE TIER, NOT RAM. This was written on a Surface Pro 4 with
  16 GB of RAM and two cores from 2015 — plenty of memory, and still the wrong
  place for a container host. A 2-core machine running Docker does not run out
  of memory, it just stops responding. Sizing on RAM alone gets this backwards,
  which is how a tablet ends up hosting a database.
#>

param([Parameter(Position = 0)][string]$Mode = '')

$ErrorActionPreference = 'SilentlyContinue'

function Hd($t)   { Write-Host ''; Write-Host "  $t" -ForegroundColor Cyan; Write-Host "  $('-' * $t.Length)" -ForegroundColor DarkGray }
function Ok($t)   { Write-Host "  [ ok ]   " -ForegroundColor Green  -NoNewline; Write-Host $t }
function Bad($t)  { Write-Host "  [ NO ]   " -ForegroundColor Red    -NoNewline; Write-Host $t }
function Warn($t) { Write-Host "  [warn]   " -ForegroundColor Yellow -NoNewline; Write-Host $t }
function Note($t) { Write-Host "           $t" -ForegroundColor DarkGray }
function Info($k, $v) { Write-Host ("  {0,-14}" -f $k) -ForegroundColor DarkGray -NoNewline; Write-Host $v }

$cs  = Get-CimInstance Win32_ComputerSystem
$os  = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1

$ramGB  = [math]::Round($cs.TotalPhysicalMemory / 1GB, 1)
$freeGB = [math]::Round($os.FreePhysicalMemory * 1KB / 1GB, 1)
$cores  = [int]$cpu.NumberOfCores
$threads= [int]$cpu.NumberOfLogicalProcessors

# The tier is the WORSE of what cores and RAM allow. A machine is only as
# capable as its tightest constraint.
#
# Calibrated against measurement, not instinct. The first cut of this demanded
# 4 cores for WORK, which declared this Surface Pro 4 unfit to run a build —
# on the same day it completed a production build in 20 seconds and a 100-route
# Playwright crawl in 2.3 minutes. A tool that contradicts what the machine
# just did is worse than no tool, so the thresholds moved to match observation.
#
# The line that genuinely matters is HUB: a container host and a database want
# real cores, and that is the boundary worth defending.
$byCores = if ($cores -ge 8) { 3 } elseif ($cores -ge 2) { 2 } else { 1 }
$byRam   = if ($ramGB -ge 31) { 3 } elseif ($ramGB -ge 8)  { 2 } else { 1 }
$tierNum = [math]::Min($byCores, $byRam)
$tier    = @{ 1 = 'FIELD'; 2 = 'WORK'; 3 = 'HUB' }[$tierNum]
$limiter = if ($byCores -lt $byRam) { "$cores cores" } elseif ($byRam -lt $byCores) { "$ramGB GB RAM" } else { 'cores and RAM together' }

Hd 'DEVICE'
Info 'Machine'  "$env:COMPUTERNAME  —  $($cs.Model)"
Info 'CPU'      "$($cpu.Name.Trim())"
Info 'Cores'    "$cores physical / $threads logical"
Info 'RAM'      "$ramGB GB total, $freeGB GB free"

Hd "TIER: $tier"
switch ($tier) {
  'FIELD' { Write-Host '  On-person device. Reaches the fleet; hosts nothing.' -ForegroundColor White }
  'WORK'  { Write-Host '  Development machine. Runs the app and a local model; not a container host.' -ForegroundColor White }
  'HUB'   { Write-Host '  Capable host. Docker, containers and the shared server belong here.' -ForegroundColor White }
}
Note "limited by $limiter"

# capability -> minimum tier
$RULES = [ordered]@{
  'Editing code, git, ops'      = 1
  'Claude Code / cloud agents'  = 1
  'Next.js dev server'          = 2
  'Production build'            = 2
  'Playwright / audit crawl'    = 2
  'Local LLM (7B via Ollama)'   = 2
  'Docker + containers'         = 3
  'Local Supabase / Postgres'   = 3
  'Shared operator server'      = 3
}

Hd 'WHAT THIS DEVICE MAY RUN'
foreach ($cap in $RULES.Keys) {
  if ($tierNum -ge $RULES[$cap]) { Ok $cap }
  else { Bad "$cap"; Note "needs tier $(@{1='FIELD';2='WORK';3='HUB'}[$RULES[$cap]]) — reach it over Tailscale instead" }
}

# ── What is actually running that this tier forbids ─────────────────
Hd 'RUNNING NOW'
$offenders = @()

$dockerProc = Get-Process -Name 'Docker Desktop', 'com.docker.backend' -ErrorAction SilentlyContinue
if ($dockerProc) {
  $mb = [math]::Round(($dockerProc | Measure-Object WorkingSet64 -Sum).Sum / 1MB)
  if ($tierNum -lt 3) { Warn "Docker Desktop is running — $mb MB"; $offenders += 'docker' }
  else { Ok "Docker Desktop — $mb MB (allowed on HUB)" }
}

$vm = Get-Process -Name 'vmmem', 'vmmemWSL' -ErrorAction SilentlyContinue
if ($vm) {
  $mb = [math]::Round(($vm | Measure-Object WorkingSet64 -Sum).Sum / 1MB)
  if ($mb -gt 500) { Warn "WSL virtual machine holding $mb MB"; $offenders += 'wsl' }
}

$ollama = Get-Process -Name 'ollama', 'ollama app' -ErrorAction SilentlyContinue
if ($ollama) {
  $mb = [math]::Round(($ollama | Measure-Object WorkingSet64 -Sum).Sum / 1MB)
  if ($mb -gt 1500 -and $tierNum -lt 2) { Warn "Ollama holding $mb MB — a model is loaded"; $offenders += 'ollama' }
  else { Ok "Ollama — $mb MB (idle, serving on demand)" }
}

$node = Get-Process -Name 'node' -ErrorAction SilentlyContinue
if ($node) {
  $mb = [math]::Round(($node | Measure-Object WorkingSet64 -Sum).Sum / 1MB)
  if ($mb -gt 2000) { Warn "node processes holding $mb MB across $($node.Count) — a dev server may have been left running"; $offenders += 'node' }
  else { Ok "node — $mb MB across $($node.Count) process(es)" }
}

if (-not $offenders) { Ok 'Nothing running above this device''s tier.' }

# ── Autostart discipline ────────────────────────────────────────────
Hd 'AUTOSTART'
$run = Get-ItemProperty 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run' -ErrorAction SilentlyContinue
$heavy = @('Docker Desktop', 'Docker', 'Rancher Desktop', 'Podman Desktop')
$found = @()
if ($run) {
  foreach ($p in $run.PSObject.Properties) {
    if ($p.Name -match '^PS') { continue }
    if ($heavy -contains $p.Name) { $found += $p.Name }
  }
}
if ($found -and $tierNum -lt 3) {
  foreach ($f in $found) { Warn "$f starts at login on a $tier device" }
  Note 'Run `ops device fix` to remove it. Docker stays installed and launchable by hand.'
} elseif ($found) {
  foreach ($f in $found) { Ok "$f starts at login (allowed on HUB)" }
} else {
  Ok 'No container runtime set to start at login.'
}

# WSL cap
$wslcfg = "$env:USERPROFILE\.wslconfig"
if (Test-Path $wslcfg) {
  $mem = (Select-String -Path $wslcfg -Pattern '^\s*memory\s*=\s*(\S+)').Matches.Groups[1].Value
  Ok "WSL capped at $mem in .wslconfig"
} elseif ($tierNum -lt 3) {
  Warn 'No .wslconfig — WSL2 may claim half this machine''s RAM'
  Note 'Run `ops device fix` to write a cap.'
}

# ── fix ─────────────────────────────────────────────────────────────
if ($Mode -match '^(fix|clean|enforce)$') {
  Hd 'FIX'
  if ($tierNum -ge 3) { Write-Host '  HUB device — nothing to restrain.' -ForegroundColor DarkGray; Write-Host ''; return }

  foreach ($f in $found) {
    Remove-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run' -Name $f -ErrorAction SilentlyContinue
    Ok "$f removed from login startup"
    Note 'Restore in Docker Desktop → Settings → General if you ever need it here.'
  }

  if (-not (Test-Path $wslcfg)) {
    @"
# Written by ``ops device fix`` on $(Get-Date -Format 'yyyy-MM-dd').
# Without this WSL2 claims up to half this machine's RAM and every core.
[wsl2]
memory=4GB
processors=2
swap=2GB
pageReporting=true
guiApplications=false
"@ | Set-Content $wslcfg -Encoding UTF8
    Ok 'Wrote .wslconfig cap (4 GB / 2 processors)'
  }

  if ($dockerProc -and $tierNum -lt 3) {
    Note 'Docker Desktop is running right now — quit it from the tray to reclaim its memory.'
  }
}

Hd 'THE SHAPE'
Write-Host '  FIELD  reaches everything, hosts nothing.' -ForegroundColor DarkGray
Write-Host '  WORK   builds and tests. Runs the app, not the infrastructure.' -ForegroundColor DarkGray
Write-Host '  HUB    Docker, database, and the server operators connect to.' -ForegroundColor DarkGray
Write-Host '         Everything else reaches the hub over Tailscale.' -ForegroundColor DarkGray
Write-Host ''
