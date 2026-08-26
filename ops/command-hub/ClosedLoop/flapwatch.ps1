# ============================================================
#  flapwatch.ps1 - fine-grained mesh flap detector.
#  Hourly sampling is too coarse to find a drop pattern. This runs
#  every few minutes and logs ONLY state changes, so the log stays
#  short and the pattern becomes obvious.
#  Log: logs\flaps.jsonl   View: ops flaps
# ============================================================
$ErrorActionPreference = 'SilentlyContinue'
$root  = Split-Path -Parent $MyInvocation.MyCommand.Path
$logs  = Join-Path $root 'logs'
$state = Join-Path $logs 'flap-state.json'
$flog  = Join-Path $logs 'flaps.jsonl'
if (-not (Test-Path $logs)) { New-Item -ItemType Directory -Path $logs | Out-Null }

# WATCH is the set of devices we care about staying up.
$WATCH = @('brainiac-7', 'fleet', 'tmmts-macbook-pro', 'watchtower')

$now = Get-Date
$cur = @{}
$j = tailscale status --json 2>$null | ConvertFrom-Json
if ($j) {
    foreach ($p in $j.Peer.PSObject.Properties.Value) {
        $n = ($p.DNSName -split '\.')[0]
        if ($WATCH -contains $n) { $cur[$n] = [bool]$p.Online }
    }
}
if ($cur.Count -eq 0) { exit 0 }   # tailscale down; nothing meaningful to record

# Load what we saw last time.
$prev = @{}
if (Test-Path $state) {
    $o = Get-Content $state -Raw | ConvertFrom-Json
    if ($o) { foreach ($pr in $o.PSObject.Properties) { $prev[$pr.Name] = $pr.Value } }
}

foreach ($name in $cur.Keys) {
    $isUp = $cur[$name]
    $was  = $prev.$name
    $wasUp   = $null
    $sinceTs = $null
    if ($was) { $wasUp = [bool]$was.up; $sinceTs = $was.since }

    if ($null -eq $wasUp) { continue }          # first sighting - just record below
    if ($wasUp -eq $isUp) { continue }          # no change

    # State flipped - log it with how long the previous state lasted.
    $mins = $null
    if ($sinceTs) {
        try { $mins = [math]::Round(((Get-Date) - [datetime]$sinceTs).TotalMinutes) } catch {}
    }
    $rec = [pscustomobject]@{
        time       = $now.ToString('yyyy-MM-dd HH:mm:ss')
        device     = $name
        change     = $(if ($isUp) { 'CAME ONLINE' } else { 'WENT OFFLINE' })
        heldMins   = $mins
    }
    ($rec | ConvertTo-Json -Compress) | Add-Content -Path $flog -Encoding UTF8
}

# Save current snapshot, preserving 'since' when the state did not change.
$snap = @{}
foreach ($name in $cur.Keys) {
    $isUp = $cur[$name]
    $since = $now.ToString('o')
    if ($prev.$name -and ([bool]$prev.$name.up) -eq $isUp -and $prev.$name.since) { $since = $prev.$name.since }
    $snap[$name] = @{ up = $isUp; since = $since }
}
($snap | ConvertTo-Json -Depth 5) | Set-Content -Path $state -Encoding UTF8
