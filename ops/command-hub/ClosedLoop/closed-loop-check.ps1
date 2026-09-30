# TMMT Closed-Loop Check - one cycle: sense mesh + local services, grade vs KPI, report.
# Standards live in KPI-STANDARDS.md next to this file.
$ErrorActionPreference = 'SilentlyContinue'
$cycleStart = Get-Date
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = Join-Path $root 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

# ---- 1. SENSE ---------------------------------------------------------------
$peers = @()
$tsJson = tailscale status --json 2>$null | ConvertFrom-Json
if ($tsJson -and $tsJson.Peer) {
    foreach ($p in $tsJson.Peer.PSObject.Properties.Value) {
        $name = ($p.DNSName -split '\.')[0]
        $ip = $p.TailscaleIPs | Where-Object { $_ -like '100.*' } | Select-Object -First 1
        $latency = $null
        $handshakeAgeSec = $null
        if ($p.LastHandshake -and $p.LastHandshake -gt [datetime]'0001-01-02') {
            try { $handshakeAgeSec = [int]((Get-Date).ToUniversalTime() - ([datetime]$p.LastHandshake).ToUniversalTime()).TotalSeconds } catch {}
        }
        if ($p.Online -and $ip) {
            # ICMP to 100.x is often blocked on Windows. Prefer Tailscale's own ping.
            try {
                $tp = & tailscale ping --c 1 --until-direct=false --timeout 2s $ip 2>&1 | Out-String
                if ($tp -match 'in\s+(\d+(?:\.\d+)?)\s*ms') { $latency = [long][math]::Round([double]$Matches[1]) }
            } catch {}
            if ($latency -eq $null) {
                $pinger = New-Object System.Net.NetworkInformation.Ping
                try {
                    $reply = $pinger.Send($ip, 1500)
                    if ($reply.Status -eq 'Success') { $latency = [long]$reply.RoundtripTime }
                } catch {}
            }
        }
        $peers += [pscustomobject]@{ Name = $name; IP = $ip; Online = [bool]$p.Online; LatencyMs = $latency; HandshakeAgeSec = $handshakeAgeSec }
    }
}

$ollamaOk = $false
try {
    $r = Invoke-WebRequest -Uri 'http://localhost:11434/api/tags' -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    $ollamaOk = ($r.StatusCode -eq 200)
} catch {}

$crimsonUp = $false
try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8770' -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    $crimsonUp = ($r.StatusCode -eq 200)
} catch {}
$crimsonTask = Get-ScheduledTask -TaskName 'CrimsonShadow-AtBoot'
$crimsonArmed = [bool]($crimsonTask -and $crimsonTask.Settings.Enabled)

$missionControlOk = Test-Path 'C:\Users\AIXMOS\CommandCenter\MissionControl\TMMT-MISSION-CONTROL.ps1'
$workSync = Get-ScheduledTask -TaskName 'TMMT-WorkSync-USB'
$workSyncOk = $workSync -and $workSync.State -in @('Ready','Running')

$disk = Get-PSDrive -Name C
$diskFreePct = if ($disk) { [math]::Round(100 * $disk.Free / ($disk.Free + $disk.Used), 1) } else { 0 }
$os = Get-CimInstance Win32_OperatingSystem
$ramFreeGB = if ($os) { [math]::Round($os.FreePhysicalMemory / 1MB, 2) } else { 0 }

# ---- 2. GRADE ---------------------------------------------------------------
$fleetOnline = ($peers | Where-Object { $_.Name -eq 'fleet' -and $_.Online }) -ne $null
$secondaries = @($peers | Where-Object { $_.Name -in @('brainiac-7','watchtower','tmmts-macbook-pro') -and $_.Online })
$onlineLat = @($peers | Where-Object { $_.Online -and $_.LatencyMs -ne $null } | ForEach-Object { $_.LatencyMs } | Sort-Object)
$medianLat = if ($onlineLat.Count) { $onlineLat[[int][math]::Floor(($onlineLat.Count - 1) / 2)] } else { $null }
$cycleSecs = [math]::Round(((Get-Date) - $cycleStart).TotalSeconds, 1)

# Crimson Shadow is graded on a live port probe, never on the task's state or
# last result. Two reasons: a task-launched pythonw reports an EMPTY CommandLine
# to Win32_Process (so process matching is blind), and a persistent server that
# gets stopped exits 267014 SCHED_S_TASK_TERMINATED, which is normal, not a fault.
# `TMMT kill` disables the task on purpose - treat that as intended, not RED.
$crimsonValue = if (-not $crimsonArmed) { 'stopped (task disabled - TMMT kill)' }
                elseif ($crimsonUp)     { 'responding' }
                else                    { 'DOWN' }
$crimsonOk = (-not $crimsonArmed) -or $crimsonUp

$kpis = @(
    [pscustomobject]@{ Id=1; KPI='Mesh core online';      Value=("fleet={0}, secondaries={1}" -f $fleetOnline, $secondaries.Count); Pass=($fleetOnline -and $secondaries.Count -ge 1) }
    [pscustomobject]@{ Id=2; KPI='Mesh latency < 150ms';  Value=$(
        if ($medianLat -ne $null) { "$medianLat ms" }
        elseif (@($peers | Where-Object { $_.Online }).Count -gt 0) { 'online, ping blocked' }
        else { 'no online peers' }
    ); Pass=$(
        if ($medianLat -ne $null) { $medianLat -lt 150 }
        else { @($peers | Where-Object { $_.Online -and $_.HandshakeAgeSec -ne $null -and $_.HandshakeAgeSec -lt 180 }).Count -ge 1 }
    ) }
    [pscustomobject]@{ Id=3; KPI='Local AI (Ollama)';     Value=$(if ($ollamaOk) { 'responding' } else { 'DOWN' }); Pass=$ollamaOk }
    [pscustomobject]@{ Id=4; KPI='Mission Control intact';Value=$(if ($missionControlOk) { 'present' } else { 'MISSING' }); Pass=$missionControlOk }
    [pscustomobject]@{ Id=5; KPI='WorkSync armed';        Value=$(if ($workSync) { $workSync.State } else { 'MISSING' }); Pass=$workSyncOk }
    [pscustomobject]@{ Id=6; KPI='Disk headroom >= 15%';  Value="$diskFreePct% free"; Pass=($diskFreePct -ge 15) }
    [pscustomobject]@{ Id=7; KPI='RAM headroom >= 1.5GB'; Value="$ramFreeGB GB free"; Pass=($ramFreeGB -ge 1.5) }
    [pscustomobject]@{ Id=8; KPI='Cycle time < 60s';      Value="$cycleSecs s"; Pass=($cycleSecs -lt 60) }
    [pscustomobject]@{ Id=9; KPI='Crimson Shadow (8770)'; Value=$crimsonValue; Pass=$crimsonOk }
)
$kpiTotal = $kpis.Count
$redCount = @($kpis | Where-Object { -not $_.Pass }).Count
$overall = if ($redCount -eq 0) { 'GREEN' } elseif ($redCount -le 2) { 'YELLOW' } else { 'RED' }

# ---- 3. REPORT --------------------------------------------------------------
$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$md = @()
$md += "# Closed-Loop Scoreboard -- $overall"
$md += ""
$md += "Last cycle: $ts  |  KPIs red: $redCount/$kpiTotal"
$md += ""
$md += "| # | KPI | Reading | Status |"
$md += "|---|-----|---------|--------|"
foreach ($k in $kpis) {
    $s = if ($k.Pass) { 'GREEN' } else { 'RED' }
    $md += "| $($k.Id) | $($k.KPI) | $($k.Value) | $s |"
}
$md += ""
$md += "## Mesh peers"
$md += ""
$md += "| Device | IP | Online | Ping |"
$md += "|--------|----|--------|------|"
foreach ($p in ($peers | Sort-Object -Property @{E={-not $_.Online}}, Name)) {
    $lat = if ($p.LatencyMs -ne $null) { "$($p.LatencyMs) ms" } else { '-' }
    $md += "| $($p.Name) | $($p.IP) | $($p.Online) | $lat |"
}
$md -join "`r`n" | Set-Content -Path (Join-Path $root 'SCOREBOARD.md') -Encoding UTF8

$record = [pscustomobject]@{
    time = $ts; overall = $overall; red = $redCount
    kpis = $kpis | Select-Object Id, KPI, Value, Pass
    peers = $peers
}
($record | ConvertTo-Json -Depth 5 -Compress) | Add-Content -Path (Join-Path $logDir 'closed-loop.jsonl') -Encoding UTF8

Write-Output "Closed-loop cycle: $overall ($redCount/$kpiTotal red) at $ts"
if ($redCount -gt 0) { $kpis | Where-Object { -not $_.Pass } | ForEach-Object { Write-Output "  RED: $($_.KPI) - $($_.Value)" } }
exit $redCount
