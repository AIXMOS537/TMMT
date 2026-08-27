# ============================================================
#  ops - the one terminal command for the whole operation.
#  Local-first. Works offline. Talks only to the Tailscale mesh.
#  Usage:  ops [command] [args]   ->  ops help
# ============================================================
param([Parameter(Position=0)][string]$Command = 'status',
      [Parameter(Position=1, ValueFromRemainingArguments=$true)][string[]]$Rest)

$ErrorActionPreference = 'SilentlyContinue'
$CC        = 'C:\Users\AIXMOS\CommandCenter'
$LOOP      = Join-Path $CC 'ClosedLoop'
$QUAR      = 'C:\Users\AIXMOS\_QUARANTINE'
$MESH_CORE = @('fleet','brainiac-7','watchtower','tmmts-macbook-pro')

function Hd($t)      { Write-Host ''; Write-Host "  $t" -ForegroundColor Cyan; Write-Host "  $('-' * $t.Length)" -ForegroundColor DarkGray }
function Ok($t)      { Write-Host "  [ OK ] " -ForegroundColor Green -NoNewline; Write-Host $t }
function Bad($t)     { Write-Host "  [FAIL] " -ForegroundColor Red -NoNewline; Write-Host $t }
function Fixed($t)   { Write-Host "  [FIXED] " -ForegroundColor Cyan -NoNewline; Write-Host $t }
function Warn($t)    { Write-Host "  [warn] " -ForegroundColor Yellow -NoNewline; Write-Host $t }
function Info($k,$v) { Write-Host ("  {0,-16}" -f $k) -ForegroundColor DarkGray -NoNewline; Write-Host $v }

# ---------- shared sensors ----------
function Get-Mesh {
    $out = @()
    $j = tailscale status --json 2>$null | ConvertFrom-Json
    if (-not $j) { return $out }
    foreach ($p in $j.Peer.PSObject.Properties.Value) {
        $out += [pscustomobject]@{
            Name   = ($p.DNSName -split '\.')[0]
            IP     = ($p.TailscaleIPs | Where-Object { $_ -like '100.*' } | Select-Object -First 1)
            Online = [bool]$p.Online
            Core   = ($MESH_CORE -contains ($p.DNSName -split '\.')[0])
        }
    }
    return $out
}
function Get-Wifi {
    $r = @{ SSID = ''; State = 'disconnected'; Signal = '' }
    foreach ($l in (netsh wlan show interfaces 2>$null)) {
        if ($l -match '^\s*SSID\s*:\s*(.+)$')   { $r.SSID   = $Matches[1].Trim() }
        if ($l -match '^\s*State\s*:\s*(.+)$')  { $r.State  = $Matches[1].Trim() }
        if ($l -match '^\s*Signal\s*:\s*(.+)$') { $r.Signal = $Matches[1].Trim() }
    }
    return $r
}
function Test-Ollama {
    try { return ((Invoke-WebRequest 'http://localhost:11434/api/tags' -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) }
    catch { return $false }
}

# ---------- commands ----------
function Cmd-Status {
    $w = Get-Wifi; $mesh = Get-Mesh
    $onCore = @($mesh | Where-Object { $_.Core -and $_.Online })
    $on     = @($mesh | Where-Object { $_.Online })

    Hd 'OPERATION STATUS'
    Info 'Time'    (Get-Date -Format 'ddd MMM d, h:mm tt')
    Info 'Machine' "$env:COMPUTERNAME  (command hub)"

    Hd 'NETWORK'
    if ($w.State -eq 'connected') {
        Ok "Wi-Fi: $($w.SSID)  [$($w.Signal)]"
        if ($w.SSID -match 'guest') { Warn 'This is a GUEST network - devices on it cannot see each other directly.' }
    } else { Bad 'Wi-Fi: not connected' }

    $ts = tailscale status 2>$null
    if ($ts) { Ok "Tailscale up - $($on.Count) of $($mesh.Count) devices online" }
    else     { Bad 'Tailscale: not running' }
    foreach ($p in ($mesh | Where-Object Core | Sort-Object Name)) {
        if ($p.Online) { Ok "  $($p.Name)" } else { Warn "  $($p.Name) - offline" }
    }

    Hd 'LOCAL BRAIN'
    if (Test-Ollama) {
        $models = @((ollama list 2>$null | Select-Object -Skip 1) | ForEach-Object { ($_ -split '\s+')[0] } | Where-Object { $_ })
        Ok "Ollama running - $($models.Count) model(s): $($models -join ', ')"
    } else { Bad 'Ollama not responding on :11434' }

    Hd 'CLOSED LOOP'
    $sb = Join-Path $LOOP 'SCOREBOARD.md'
    if (Test-Path $sb) {
        $head = (Get-Content $sb -TotalCount 3)
        $grade = if ($head[0] -match 'GREEN') { 'GREEN' } elseif ($head[0] -match 'YELLOW') { 'YELLOW' } else { 'RED' }
        $age = [math]::Round(((Get-Date) - (Get-Item $sb).LastWriteTime).TotalMinutes)
        switch ($grade) {
            'GREEN'  { Ok   "Scoreboard: GREEN   (checked $age min ago)" }
            'YELLOW' { Warn "Scoreboard: YELLOW  (checked $age min ago) - run: ops check" }
            default  { Bad  "Scoreboard: RED     (checked $age min ago) - run: ops check" }
        }
    } else { Warn 'No scoreboard yet - run: ops check' }

    Write-Host ''
    Write-Host "  Type 'ops help' for everything you can do." -ForegroundColor DarkGray
    Write-Host ''
}

function Cmd-Check {
    Hd 'RUNNING CLOSED-LOOP CYCLE'
    & (Join-Path $LOOP 'closed-loop-check.ps1')
    Write-Host ''
    Write-Host "  Full scoreboard: $LOOP\SCOREBOARD.md" -ForegroundColor DarkGray
    Write-Host ''
}

function Cmd-Mesh {
    Hd 'TAILSCALE MESH'
    $mesh = Get-Mesh
    if (-not $mesh) { Bad 'Tailscale not running or no peers.'; return }
    "  {0,-22} {1,-16} {2,-8} {3}" -f 'DEVICE','IP','STATUS','ROLE' | Write-Host -ForegroundColor DarkGray
    foreach ($p in ($mesh | Sort-Object @{E={-not $_.Online}}, @{E={-not $_.Core}}, Name)) {
        $st = if ($p.Online) { 'online' } else { 'offline' }
        $col = if ($p.Online) { 'Green' } else { 'DarkGray' }
        $role = if ($p.Core) { 'core' } else { '' }
        Write-Host ("  {0,-22} {1,-16} {2,-8} {3}" -f $p.Name, $p.IP, $st, $role) -ForegroundColor $col
    }
    Write-Host ''
}

function Cmd-Wifi {
    $w = Get-Wifi
    Hd 'WI-FI'
    Info 'Connected to' $(if ($w.SSID) { "$($w.SSID)  [$($w.Signal)]" } else { '(nothing)' })
    if ($w.SSID -match 'guest') {
        Warn 'Guest network: your other devices are NOT directly reachable.'
        Warn 'Tailscale still works (it tunnels out), so ops keeps running.'
    }
    Hd 'IN RANGE NOW'
    $inRange = @(netsh wlan show networks 2>$null | Select-String '^SSID' | ForEach-Object { ($_ -split ':',2)[1].Trim() })
    if ($inRange) { $inRange | ForEach-Object { Write-Host "    $_" } } else { Write-Host '    (none found)' }
    Hd 'SAVED NETWORKS'
    @(netsh wlan show profiles 2>$null | Select-String 'All User Profile' | ForEach-Object { ($_ -split ':',2)[1].Trim() }) |
        ForEach-Object { $mark = if ($inRange -contains $_) { '  <- in range' } else { '' }; Write-Host "    $_$mark" -ForegroundColor $(if($mark){'Green'}else{'DarkGray'}) }
    Write-Host ''
    Write-Host '  To switch:  ops wifi-join "NETWORK NAME"' -ForegroundColor DarkGray
    Write-Host ''
}

function Cmd-WifiJoin {
    $target = ($Rest -join ' ').Trim('"').Trim()
    if (-not $target) { Bad 'Give me a network name:  ops wifi-join "TMMT 1"'; return }
    Hd "JOINING: $target"
    netsh wlan connect name="$target" 2>&1 | ForEach-Object { Write-Host "  $_" }
    Start-Sleep -Seconds 4
    $w = Get-Wifi
    if ($w.SSID -eq $target) { Ok "Connected to $target" } else { Warn "Now on: $($w.SSID)" }
    Write-Host ''
}

function Cmd-Ai {
    $q = ($Rest -join ' ').Trim()
    if (-not $q) { Bad 'Ask something:  ops ai "what should I check first today?"'; return }
    if (-not (Test-Ollama)) { Bad 'Local AI is not running. Start Ollama first.'; return }
    $model = @((ollama list 2>$null | Select-Object -Skip 1) | ForEach-Object { ($_ -split '\s+')[0] } | Where-Object { $_ }) |
             Sort-Object { if ($_ -match '7b') { 0 } else { 1 } } | Select-Object -First 1
    Hd "LOCAL AI ($model)"
    $body = @{ model = $model; prompt = $q; stream = $false } | ConvertTo-Json
    try {
        $r = Invoke-RestMethod 'http://localhost:11434/api/generate' -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 180
        Write-Host ''
        ($r.response -split "`n") | ForEach-Object { Write-Host "  $_" }
    } catch { Bad "Local AI failed: $($_.Exception.Message)" }
    Write-Host ''
}

function Cmd-Tools {
    Hd 'LOCAL TOOLS IN THIS TERMINAL'
    $tools = [ordered]@{
        'git'='version control'; 'node'='JavaScript runtime'; 'npm'='package installer';
        'python'='Python'; 'pip'='Python packages'; 'docker'='containers';
        'ollama'='offline AI'; 'gh'='GitHub'; 'code'='VS Code'; 'cursor'='Cursor editor';
        'tailscale'='the mesh'; 'pwsh'='PowerShell 7'; 'winget'='app installer'; 'curl'='fetch URLs'
    }
    foreach ($t in $tools.Keys) {
        $c = Get-Command $t -ErrorAction SilentlyContinue
        if ($c) { Write-Host ("  {0,-12} {1,-22} " -f $t, $tools[$t]) -NoNewline; Write-Host 'ready' -ForegroundColor Green }
        else    { Write-Host ("  {0,-12} {1,-22} " -f $t, $tools[$t]) -NoNewline; Write-Host 'not installed' -ForegroundColor DarkGray }
    }
    Write-Host ''
}

function Cmd-Clean {
    Hd 'CLEANUP (reversible - nothing is deleted)'
    if (-not (Test-Path $QUAR)) { New-Item -ItemType Directory -Path $QUAR -Force | Out-Null }
    $stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
    $dest = Join-Path $QUAR $stamp
    New-Item -ItemType Directory -Path $dest -Force | Out-Null

    $moved = 0; $bytes = 0
    # Installers for software already installed - safe, re-downloadable.
    $installers = @(Get-ChildItem 'C:\Users\AIXMOS\Downloads' -File -ErrorAction SilentlyContinue |
                    Where-Object { $_.Extension -in '.exe','.msi' })
    foreach ($f in $installers) {
        $bytes += $f.Length; Move-Item $f.FullName -Destination $dest -Force; $moved++
        Write-Host "    moved  $($f.Name)" -ForegroundColor DarkGray
    }
    if ($moved) { Ok ("Quarantined $moved installer(s), {0:N0} MB freed" -f ($bytes/1MB)) }
    else { Info 'Downloads' 'already clean' }
    Write-Host ''
    Write-Host "  Everything is in: $dest" -ForegroundColor DarkGray
    Write-Host "  Wrong call? Move it straight back - nothing was deleted." -ForegroundColor DarkGray
    Write-Host ''
}

function Cmd-Go {
    $mc = Join-Path $CC 'MissionControl\TMMT-MISSION-CONTROL.ps1'
    if (Test-Path $mc) { Hd 'LAUNCHING MISSION CONTROL'; & $mc }
    else { Bad "Mission Control not found at $mc" }
}

function Cmd-Brain {
    & (Join-Path $PSScriptRoot 'brain.ps1') @Rest
}

# The app lives here. Every app command cd's in first, so none of them care
# where you were standing when you typed it.
$APP_DIR = 'C:\Users\AIXMOS\TMMT'

function Invoke-InApp([string]$Script) {
    if (-not (Test-Path $APP_DIR)) { Bad "App not found at $APP_DIR"; return }
    Push-Location $APP_DIR
    try { & npm run $Script } finally { Pop-Location }
}

function Cmd-Audit {
    Hd 'AUDIT - DRIVE THE WHOLE APP AND REPORT WHAT BREAKS'
    # Run the three gates separately rather than chaining them. `audit:static`
    # short-circuits on the first failure, so with lint currently red the build
    # gate never ran - and the build is the one that actually decides shippable.
    if ($Rest -contains 'static') {
        if (-not (Test-Path $APP_DIR)) { Bad "App not found at $APP_DIR"; return }
        Push-Location $APP_DIR
        try {
            foreach ($g in @(@{n='typecheck'; s='typecheck'}, @{n='lint'; s='lint'}, @{n='build'; s='build'})) {
                Write-Host ''
                Write-Host "  --- $($g.n) ---" -ForegroundColor DarkGray
                $out = & npm run $g.s 2>&1
                if ($LASTEXITCODE -eq 0) { Ok "$($g.n) passed" }
                else {
                    Bad "$($g.n) failed"
                    $out | Select-Object -Last 6 | ForEach-Object { Write-Host "       $_" -ForegroundColor DarkGray }
                }
            }
        } finally { Pop-Location }
        Write-Host ''
        return
    }
    Invoke-InApp 'audit'
    $f = Join-Path $APP_DIR 'audit\FINDINGS.md'
    if (Test-Path $f) { Write-Host ''; Ok "findings: $f" }
}

function Cmd-Snapshot {
    & (Join-Path $PSScriptRoot 'snapshot.ps1') @Rest
}

function Cmd-GoLive {
    & (Join-Path $PSScriptRoot 'golive.ps1') @Rest
}

function Cmd-Sync {
    & (Join-Path $PSScriptRoot 'sync.ps1') @Rest
}

function Cmd-Device {
    & (Join-Path $PSScriptRoot 'device.ps1') @Rest
}

function Cmd-Dev {
    Hd 'DEV SERVER'
    Warn 'Auth is OFF under next dev - see docs\AUDIT.md. Judge auth on a build.'
    Invoke-InApp 'dev'
}

function Cmd-Build { Hd 'PRODUCTION BUILD'; Invoke-InApp 'build' }

function Cmd-Agents {
    Hd 'AGENTS AVAILABLE TO YOU'
    Write-Host ''
    Write-Host '  LOCAL - free, offline, no account needed' -ForegroundColor Green
    if (Test-Ollama) {
        $models = @((ollama list 2>$null | Select-Object -Skip 1) | ForEach-Object { ($_ -split '\s+')[0] } | Where-Object { $_ })
        Ok 'ops brain "task"       the local agent (reads, searches, checks)'
        foreach ($m in $models) { Write-Host "         model: $m" -ForegroundColor DarkGray }
    } else { Bad 'Ollama is not running - the local agent needs it' }
    if (Get-Command opencode -ErrorAction SilentlyContinue) {
        Ok 'opencode              local coding agent (wired to Ollama)'
    } else { Warn 'opencode not on PATH' }
    Write-Host ''
    Write-Host '  CLOUD - stronger, needs an account' -ForegroundColor Yellow
    if (Get-Command claude -ErrorAction SilentlyContinue) {
        Ok 'claude                Claude Code CLI'
    } else {
        Warn 'claude                not installed'
        Write-Host '           install: npm install -g @anthropic-ai/claude-code' -ForegroundColor DarkGray
    }
    Write-Host ''
    Write-Host '  Rule of thumb: try ops brain first. It costs nothing.' -ForegroundColor DarkGray
    Write-Host '  Reach for Claude when the job needs real reasoning or code.' -ForegroundColor DarkGray
    Write-Host ''
}

function Cmd-Flaps {
    Hd 'MESH STABILITY - WHO KEEPS DROPPING'
    $flog = Join-Path $LOOP 'logs/flaps.jsonl'
    $state = Join-Path $LOOP 'logs/flap-state.json'

    if (Test-Path $state) {
        $st = Get-Content $state -Raw | ConvertFrom-Json
        Write-Host ''
        Write-Host '  RIGHT NOW' -ForegroundColor White
        foreach ($pr in $st.PSObject.Properties) {
            $held = ''
            try { $held = '  (' + [math]::Round(((Get-Date) - [datetime]$pr.Value.since).TotalMinutes) + ' min)' } catch {}
            if ($pr.Value.up) { Ok  "$($pr.Name) up$held" }
            else              { Warn "$($pr.Name) down$held" }
        }
    }

    if (-not (Test-Path $flog)) {
        Write-Host ''
        Write-Host '  No state changes recorded yet. The watcher runs every 5 minutes.' -ForegroundColor DarkGray
        Write-Host '  Give it a few hours and the pattern will show up here.' -ForegroundColor DarkGray
        Write-Host ''
        return
    }

    $events = @(Get-Content $flog | Where-Object { $_ } | ForEach-Object { $_ | ConvertFrom-Json })
    if ($Rest -and $Rest[0]) { $events = @($events | Where-Object { $_.device -eq $Rest[0] }) }

    Write-Host ''
    Write-Host "  CHANGES ($($events.Count) recorded)" -ForegroundColor White
    foreach ($e in ($events | Select-Object -Last 25)) {
        $held = if ($e.heldMins -ne $null) { " after $($e.heldMins) min" } else { '' }
        $col = if ($e.change -eq 'CAME ONLINE') { 'Green' } else { 'Yellow' }
        Write-Host ("    {0}  {1,-20} {2}{3}" -f $e.time, $e.device, $e.change, $held) -ForegroundColor $col
    }

    Write-Host ''
    Write-Host '  DROPS PER DEVICE' -ForegroundColor White
    $drops = @($events | Where-Object { $_.change -eq 'WENT OFFLINE' })
    if ($drops) {
        foreach ($g in ($drops | Group-Object device | Sort-Object Count -Descending)) {
            $avg = @($g.Group | Where-Object { $_.heldMins -ne $null } | ForEach-Object { $_.heldMins })
            $avgTxt = if ($avg.Count) { "  avg uptime $([math]::Round(($avg | Measure-Object -Average).Average)) min" } else { '' }
            Write-Host ("    {0,-20} {1} drop(s){2}" -f $g.Name, $g.Count, $avgTxt)
        }
    } else { Write-Host '    none yet' -ForegroundColor DarkGray }
    Write-Host ''
    Write-Host '  Fix a flapping Windows box:  ops fix-flapping' -ForegroundColor DarkGray
    Write-Host ''
}

function Cmd-FixFlapping {
    $f = Join-Path $PSScriptRoot 'fix-brainiac-flapping.ps1'
    $target = if ($Rest -and $Rest[0]) { $Rest[0] } else { 'brainiac-7' }
    Hd 'FLAPPING FIX'
    Write-Host '  This fixes the machine it RUNS ON - so it has to get to the flapping box.' -ForegroundColor Yellow
    Write-Host ''

    $mesh = Get-Mesh
    $peer = $mesh | Where-Object { $_.Name -eq $target }
    if ($peer -and $peer.Online) {
        Ok "$target is online - sending the script over Taildrop now."
        & tailscale file cp $f "${target}:" 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Fixed "Sent. On $target it lands in Downloads (or the Tailscale notification)."
        } else {
            Bad 'Taildrop failed. Copy the script over by hand instead.'
        }
    } else {
        Warn "$target is offline - cannot send. Re-run this when it is up."
    }

    Write-Host ''
    Write-Host "  THEN, ON $($target.ToUpper()):" -ForegroundColor White
    Write-Host '    1. Open PowerShell as Administrator'
    Write-Host '    2. Look first, change nothing:'
    Write-Host '         powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads/fix-brainiac-flapping.ps1" -Report' -ForegroundColor Cyan
    Write-Host '    3. Apply the fixes:'
    Write-Host '         powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads/fix-brainiac-flapping.ps1"' -ForegroundColor Cyan
    Write-Host '    4. Reboot.'
    Write-Host ''
    Write-Host '  Then watch it hold:  ops flaps' -ForegroundColor DarkGray
    Write-Host ''
    Write-Host '  NOTE: this fixes sleep, logout and power-saving drops.' -ForegroundColor DarkGray
    Write-Host '  If the machine is physically shut down, no setting can keep it online.' -ForegroundColor DarkGray
    Write-Host ''
}

function Cmd-Help {
    Hd 'OPS - RUN THE WHOLE OPERATION FROM HERE'
    $rows = [ordered]@{
        'ops'                      = 'the dashboard - is everything OK right now?'
        'ops check'                = 'run the 8-point closed-loop check now'
        'ops mesh'                 = 'show every device on the Tailscale mesh'
        'ops wifi'                 = 'Wi-Fi status, what is in range, saved networks'
        'ops wifi-join "NAME"'     = 'switch to a saved Wi-Fi network'
        'ops ai "question"'        = 'ask the offline AI (no internet needed)'
        'ops tools'                = 'every local tool and whether it is ready'
        'ops clean'                = 'quarantine junk (reversible, never deletes)'
        'ops brain "task"'         = 'the LOCAL agent - free, offline, uses tools'
        'ops agents'               = 'every agent available and what it costs'
        'ops flaps'                = 'which devices keep dropping off the mesh'
        'ops fix-flapping'         = 'how to stop a Windows box dropping off'
        'ops go'                   = 'open Mission Control'
        'ops dev'                  = 'start the TMMT rental app locally (next dev)'
        'ops build'                = 'production build of the TMMT rental app'
        'ops audit'                = 'browser-crawl the TMMT app and write findings'
        'ops snapshot'             = 'pack app+build state for the next agent'
        'ops golive'               = 'is the public door open and the admin still gated?'
        'ops sync'                 = 'mirror the tablet onto every attached flashdrive'
        'ops device'               = 'what may this machine run? (and what should not be running)'
        'ops help'                 = 'this list'
    }
    foreach ($k in $rows.Keys) {
        Write-Host ("  {0,-24}" -f $k) -ForegroundColor White -NoNewline
        Write-Host $rows[$k] -ForegroundColor Gray
    }
    Write-Host ''
    Write-Host '  Everything above runs locally. Only the mesh reaches out.' -ForegroundColor DarkGray
    Write-Host ''
}

switch -Regex ($Command.ToLower()) {
    '^(status|dash|)$'      { Cmd-Status }
    '^check$'               { Cmd-Check }
    '^mesh$'                { Cmd-Mesh }
    '^wifi$'                { Cmd-Wifi }
    '^wifi-?join$'          { Cmd-WifiJoin }
    '^(ai|ask)$'            { Cmd-Ai }
    '^tools$'               { Cmd-Tools }
    '^clean(up)?$'          { Cmd-Clean }
    '^(brain|agent)$'       { Cmd-Brain }
    '^agents$'              { Cmd-Agents }
    '^flaps?$'              { Cmd-Flaps }
    '^fix-?flapping$'       { Cmd-FixFlapping }
    '^go$'                  { Cmd-Go }
    '^dev$'                 { Cmd-Dev }
    '^build$'               { Cmd-Build }
    '^audit$'               { Cmd-Audit }
    '^snapshot$'            { Cmd-Snapshot }
    '^go-?live$'            { Cmd-GoLive }
    '^sync$'                { Cmd-Sync }
    '^device$'              { Cmd-Device }
    '^(help|-h|--help|\?)$' { Cmd-Help }
    default { Bad "Unknown command: $Command"; Cmd-Help }
}
