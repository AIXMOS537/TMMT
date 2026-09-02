# ============================================================
#  brain.ps1 - the local agent. Runs on YOUR tablet, costs nothing.
#  A real tool-using loop: it reads, searches, checks, and reports.
#  Safety: read-mostly. Whitelisted folders only. No arbitrary shell.
#  Usage:  ops brain "your task"      (fast 3B)
#          ops brain -Big "your task" (smarter 7B, slower)
# ============================================================
param(
    [Parameter(Position=0, ValueFromRemainingArguments=$true)][string[]]$Task,
    [switch]$Big,
    [int]$MaxSteps = 6,
    [switch]$Quiet
)
$ErrorActionPreference = 'SilentlyContinue'

$OLLAMA = 'http://localhost:11434'
$MODEL  = if ($Big) { 'qwen7b-max:latest' } else { 'qwen3b-max:latest' }
$CC     = 'C:\Users\AIXMOS\CommandCenter'
$NOTES  = Join-Path $CC 'ops\notes'

# Folders the agent may look at. Everything else is invisible to it.
$ALLOWED = @(
    'C:\Users\AIXMOS\CommandCenter',
    'C:\Users\AIXMOS\TMMT-canon',
    'C:\Users\AIXMOS\AIXMOS-Brain',
    'C:\Users\AIXMOS\Automation',
    'C:\Users\AIXMOS\LocalModels',
    'C:\Users\AIXMOS\Desktop'
)
# Never surface these, even inside allowed folders.
$BLOCKED = 'secret|credential|password|token|apikey|api_key|\.pem|\.key$|id_rsa|\.env'

function Say($t, $c = 'Gray') { if (-not $Quiet) { Write-Host $t -ForegroundColor $c } }

function Test-Allowed($p) {
    if (-not $p) { return $false }
    try { $full = [IO.Path]::GetFullPath($p) } catch { return $false }
    if ($full -match $BLOCKED) { return $false }
    foreach ($root in $ALLOWED) { if ($full.StartsWith($root, 'OrdinalIgnoreCase')) { return $true } }
    return $false
}

# ---------------- the agent's tools ----------------
function Tool-GetStatus {
    $lines = @()
    $j = tailscale status --json 2>$null | ConvertFrom-Json
    if ($j) {
        $peers = @($j.Peer.PSObject.Properties.Value)
        $on = @($peers | Where-Object { $_.Online })
        # Spell it out plainly - small models misread scattered per-line status.
        $onNames  = @($peers | Where-Object { $_.Online }     | ForEach-Object { ($_.DNSName -split '\.')[0] })
        $offNames = @($peers | Where-Object { -not $_.Online } | ForEach-Object { ($_.DNSName -split '\.')[0] })
        $lines += "MESH: $($on.Count) of $($peers.Count) devices are ONLINE."
        $lines += "ONLINE devices ($($onNames.Count)): $($onNames -join ', ')"
        $lines += "OFFLINE devices ($($offNames.Count)): $($offNames -join ', ')" 
    } else {
        $lines += 'Mesh: tailscale not running.'
    }
    foreach ($l in (netsh wlan show interfaces 2>$null)) {
        if ($l -match '^\s*SSID\s*:\s*(.+)$') { $lines += "WiFi: $($Matches[1].Trim())" }
    }
    $sb = Join-Path $CC 'ClosedLoop\SCOREBOARD.md'
    if (Test-Path $sb) {
        $grade = (Get-Content $sb -TotalCount 1) -replace '#\s*Closed-Loop Scoreboard --\s*', ''
        $lines += "Closed loop grade: $grade"
    }
    $d = Get-PSDrive C
    $lines += ("Disk: {0:N0} GB free of {1:N0} GB." -f ($d.Free / 1GB), (($d.Free + $d.Used) / 1GB))
    return ($lines -join "`n")
}

function Tool-ListFiles($path) {
    if (-not (Test-Allowed $path)) { return "DENIED: '$path' is outside the folders I am allowed to read." }
    if (-not (Test-Path $path)) { return "Not found: $path" }
    $items = @(Get-ChildItem $path -Force -ErrorAction SilentlyContinue | Select-Object -First 60)
    if (-not $items) { return "$path is empty." }
    $out = foreach ($i in $items) {
        if ($i.PSIsContainer) { "[dir]  $($i.Name)" }
        else { "       $($i.Name)  ($([math]::Round($i.Length / 1KB, 1)) KB)" }
    }
    return ($out -join "`n")
}

function Tool-ReadFile($path) {
    if (-not (Test-Allowed $path)) { return "DENIED: '$path' is outside the folders I am allowed to read." }
    if (-not (Test-Path $path)) { return "Not found: $path" }
    $item = Get-Item $path
    if ($item.Length -gt 120KB) { return "Too big ($([math]::Round($item.Length / 1KB)) KB). Search it instead." }
    return (Get-Content $path -TotalCount 200 -ErrorAction SilentlyContinue | Out-String)
}

function Tool-SearchFiles($pattern, $path) {
    if (-not $pattern) { return 'Need something to search for.' }
    # Be forgiving: a bad or missing path means search every operation folder.
    $roots = @()
    if ($path -and (Test-Allowed $path) -and (Test-Path $path)) { $roots = @($path) }
    else { $roots = $ALLOWED | Where-Object { Test-Path $_ } }
    $hits = @()
    foreach ($r in $roots) {
        $files = @(Get-ChildItem $r -Recurse -File -Include *.md, *.txt, *.ps1, *.json, *.bat -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch 'node_modules' -and $_.FullName -notmatch '\.git' -and $_.FullName -notmatch $BLOCKED } |
            Select-Object -First 300)
        $hits += @($files | Select-String -Pattern $pattern -SimpleMatch -ErrorAction SilentlyContinue)
        if ($hits.Count -ge 20) { break }
    }
    $hits = @($hits | Select-Object -First 20)
    if (-not $hits) { return "No matches for '$pattern' anywhere in the operation folders." }
    $out = foreach ($h in $hits) { "$($h.Path): $($h.Line.Trim())" }
    return (($out -join "`n"))
}

function Tool-RunCheck {
    $out = & (Join-Path $CC 'ClosedLoop\closed-loop-check.ps1') 2>&1 | Out-String
    return $out.Trim()
}

function Tool-SaveNote($title, $content) {
    if (-not $title) { return 'Need a title.' }
    $safe = (($title -replace '[^\w\- ]', '').Trim() -replace '\s+', '-')
    if (-not $safe) { $safe = 'note' }
    $f = Join-Path $NOTES ("{0}_{1}.md" -f (Get-Date -Format 'yyyy-MM-dd'), $safe)
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
    $doc = "# $title" + "`n`n" + "_Written by the local brain on ${stamp}_" + "`n`n" + $content
    $doc | Set-Content -Path $f -Encoding UTF8
    return "Saved to $f"
}

# ---------------- tool schema for the model ----------------
$tools = @(
    @{ type = 'function'; function = @{ name = 'get_status'; description = 'Current state of the operation: mesh devices, wifi, closed-loop grade, disk space. Call this first for any question about how things are running.'; parameters = @{ type = 'object'; properties = @{}; required = @() } } },
    @{ type = 'function'; function = @{ name = 'list_files'; description = 'List files in a folder.'; parameters = @{ type = 'object'; properties = @{ path = @{ type = 'string'; description = 'Full folder path' } }; required = @('path') } } },
    @{ type = 'function'; function = @{ name = 'read_file'; description = 'Read a text file.'; parameters = @{ type = 'object'; properties = @{ path = @{ type = 'string'; description = 'Full file path' } }; required = @('path') } } },
    @{ type = 'function'; function = @{ name = 'search_files'; description = 'Search for text across the operation folders.'; parameters = @{ type = 'object'; properties = @{ pattern = @{ type = 'string'; description = 'Text to find' }; path = @{ type = 'string'; description = 'Folder to search, optional' } }; required = @('pattern') } } },
    @{ type = 'function'; function = @{ name = 'run_closed_loop_check'; description = 'Run the 8-point KPI health check right now and return the grade.'; parameters = @{ type = 'object'; properties = @{}; required = @() } } },
    @{ type = 'function'; function = @{ name = 'save_note'; description = 'Save findings to a note file for later.'; parameters = @{ type = 'object'; properties = @{ title = @{ type = 'string'; description = 'Short title' }; content = @{ type = 'string'; description = 'Body of the note' } }; required = @('title', 'content') } } }
)

function Invoke-Tool($name, $a) {
    switch ($name) {
        'get_status' { return Tool-GetStatus }
        'list_files' { return Tool-ListFiles $a.path }
        'read_file' { return Tool-ReadFile $a.path }
        'search_files' { return Tool-SearchFiles $a.pattern $a.path }
        'run_closed_loop_check' { return Tool-RunCheck }
        'save_note' { return Tool-SaveNote $a.title $a.content }
        default { return "No such tool: $name" }
    }
}

# ---------------- the loop ----------------
$question = ($Task -join ' ').Trim()
if (-not $question) {
    Write-Host ''
    Write-Host '  Give me a job. Examples:' -ForegroundColor Cyan
    Write-Host '    ops brain "how is the operation doing right now?"'
    Write-Host '    ops brain "what does the closed loop check actually check?"'
    Write-Host '    ops brain "find every mention of WorkSync and explain it"'
    Write-Host ''
    exit 0
}

$today = Get-Date -Format 'dddd, MMMM d, yyyy'
$sys = "You are the local brain for TMMT, running offline on Muhammad Taha's command tablet. " +
       "You have tools. USE THEM before answering - never guess about the state of the system. " +
       "For any question about how things are running, call get_status first. " +
       "Be direct and brief. Plain language, short sentences. When you have the answer, just say it. " +
       "Today is $today."

$messages = @(
    @{ role = 'system'; content = $sys },
    @{ role = 'user'; content = $question }
)

Say ''
Say "  LOCAL BRAIN  ($MODEL, offline, free)" 'Cyan'
Say "  ----------------------------------------------" 'DarkGray'
Say "  Task: $question" 'White'
Say ''

for ($step = 1; $step -le $MaxSteps; $step++) {
    $body = @{ model = $MODEL; messages = $messages; tools = $tools; stream = $false } | ConvertTo-Json -Depth 12
    try {
        $resp = Invoke-RestMethod "$OLLAMA/api/chat" -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 600
    } catch {
        Write-Host "  Local brain failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
    $msg = $resp.message
    # @($null) yields a 1-element array in PowerShell - filter or the final answer looks like a call.
    $calls = @($msg.tool_calls | Where-Object { $_ -and $_.function -and $_.function.name })

    if ($calls.Count -gt 0) {
        # Rebuild tool_calls clean - echoing back 'id'/'index' confuses the model.
        $clean = @()
        foreach ($c in $calls) {
            $a = @{}
            if ($c.function.arguments) {
                foreach ($pr in $c.function.arguments.PSObject.Properties) { $a[$pr.Name] = $pr.Value }
            }
            $clean += @{ function = @{ name = $c.function.name; arguments = $a } }
        }
        $messages += @{ role = 'assistant'; content = [string]$msg.content; tool_calls = $clean }
        foreach ($c in $calls) {
            $fn = $c.function.name
            $fargs = $c.function.arguments
            $argTxt = ''
            if ($fargs) { $argTxt = (($fargs.PSObject.Properties | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join ', ') }
            Say ("  [{0}] {1}({2})" -f $step, $fn, $argTxt) 'DarkCyan'
            $result = Invoke-Tool $fn $fargs
            if ($result -is [array]) { $result = $result -join "`n" }
            $result = [string]$result
            if ($result.Length -gt 6000) { $result = $result.Substring(0, 6000) + "`n...(truncated)" }
            $messages += @{ role = 'tool'; content = $result; tool_name = $fn }
        }
        continue
    }

    Say ''
    $answer = [string]$msg.content
    ($answer -split "`n") | ForEach-Object { Write-Host "  $_" }
    Say ''
    exit 0
}

Write-Host "  (stopped after $MaxSteps steps - ask something narrower)" -ForegroundColor Yellow
