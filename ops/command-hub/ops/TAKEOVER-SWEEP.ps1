# TAKEOVER-SWEEP.ps1 - one-shot live verification of hub, tools, agents, apps.
# ASCII only. Read-only except it may write SCOREBOARD.md via ops check.
$ErrorActionPreference = 'Continue'
$ops = 'C:\Users\AIXMOS\CommandCenter\ops\ops.ps1'
function Section($t) { Write-Host ''; Write-Host "======== $t ========" -ForegroundColor Cyan }

Section 'CLAUDE SESSIONS (PIDs from ~/.claude/sessions)'
$sessDir = 'C:\Users\AIXMOS\.claude\sessions'
Get-ChildItem $sessDir -Filter '*.json' | ForEach-Object {
    $j = Get-Content $_.FullName -Raw | ConvertFrom-Json
    $alive = Get-Process -Id $j.pid -ErrorAction SilentlyContinue
    $state = if ($alive) { 'RUNNING' } else { 'dead' }
    '{0}  pid={1}  {2}  cwd={3}  session={4}' -f $state, $j.pid, $j.name, $j.cwd, $j.sessionId
}

Section 'OPS STATUS'
& powershell -NoProfile -ExecutionPolicy Bypass -File $ops status

Section 'OPS TOOLS'
& powershell -NoProfile -ExecutionPolicy Bypass -File $ops tools

Section 'OPS AGENTS'
& powershell -NoProfile -ExecutionPolicy Bypass -File $ops agents

Section 'OPS MESH'
& powershell -NoProfile -ExecutionPolicy Bypass -File $ops mesh

Section 'OPS FLAPS'
& powershell -NoProfile -ExecutionPolicy Bypass -File $ops flaps

Section 'TOOL VERSIONS'
foreach ($cmd in @('git','node','npm','python','pip','docker','ollama','gh','cursor','code','tailscale','pwsh','claude','opencode','winget')) {
    $c = Get-Command $cmd -ErrorAction SilentlyContinue
    if (-not $c) { '[MISS] {0}' -f $cmd; continue }
    $ver = ''
    try {
        switch ($cmd) {
            'git'       { $ver = (git --version 2>$null) }
            'node'      { $ver = (node -v 2>$null) }
            'npm'       { $ver = (npm -v 2>$null) }
            'python'    { $ver = (python --version 2>$null) }
            'docker'    { $ver = (docker --version 2>$null) }
            'ollama'    { $ver = (ollama -v 2>$null) }
            'gh'        { $ver = (gh --version 2>$null | Select-Object -First 1) }
            'tailscale' { $ver = (tailscale version 2>$null | Select-Object -First 1) }
            'pwsh'      { $ver = (pwsh -NoProfile -Command '$PSVersionTable.PSVersion.ToString()' 2>$null) }
            'claude'    { $ver = (claude --version 2>$null | Select-Object -First 1) }
            'opencode'  { $ver = (opencode --version 2>$null | Select-Object -First 1) }
            default     { $ver = 'present' }
        }
    } catch { $ver = 'present (version failed)' }
    '[OK]   {0,-12} {1}' -f $cmd, $ver
}

Section 'LISTENERS (dev / crimson / ollama)'
netstat -ano | Select-String ':3000 |:3001 |:8770 |:11434 '

Section 'HTTP PROBES'
function Probe($name, $url) {
    try {
        $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 5
        '[OK]   {0}  {1}  {2}' -f $name, $r.StatusCode, $url
    } catch {
        '[FAIL] {0}  {1}  {2}' -f $name, $_.Exception.Message, $url
    }
}
Probe 'Ollama tags'        'http://127.0.0.1:11434/api/tags'
Probe 'Crimson Shadow'     'http://127.0.0.1:8770/'
Probe 'TMMT local :3000'   'http://127.0.0.1:3000/'
Probe 'TMMT-OS cloud'      'https://tmmt-ops.vercel.app/'

Section 'OLLAMA TALK (tiny generate)'
try {
    $body = @{ model = 'qwen3b-max:latest'; prompt = 'Reply with exactly: PONG'; stream = $false; options = @{ num_predict = 16 } } | ConvertTo-Json -Compress
    $r = Invoke-RestMethod 'http://127.0.0.1:11434/api/generate' -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 90
    $txt = (($r.response) -replace '\s+',' ').Trim()
    if ($txt) { '[OK]   ollama said: ' + $txt.Substring(0, [Math]::Min(120, $txt.Length)) }
    else { '[FAIL] ollama empty response' }
} catch { '[FAIL] ollama generate: ' + $_.Exception.Message }

Section 'SCHEDULED TASKS'
foreach ($n in @('TMMT-ClosedLoop','TMMT-FlapWatch','TMMT-WorkSync-USB','CrimsonShadow-AtBoot','TMMT-FreeRAM')) {
    $t = Get-ScheduledTask -TaskName $n -ErrorAction SilentlyContinue
    if ($t) { '[OK]   {0,-24} state={1} enabled={2}' -f $n, $t.State, $t.Settings.Enabled }
    else    { '[MISS] {0}' -f $n }
}

Section 'GIT REPOS'
function Repo($path) {
    if (-not (Test-Path (Join-Path $path '.git'))) { '[MISS] {0}' -f $path; return }
    Push-Location $path
    $br = (git branch --show-current 2>$null)
    $sb = (git status -sb 2>$null | Select-Object -First 1)
    $dirty = @(git status --porcelain 2>$null).Count
    $remote = (git remote get-url origin 2>$null)
    if (-not $remote) { $remote = '(no remote)' }
    $nm = Test-Path 'node_modules'
    '[REPO] {0}' -f $path
    '       branch={0}  dirty={1}  node_modules={2}' -f $br, $dirty, $nm
    '       {0}' -f $sb
    '       origin={0}' -f $remote
    Pop-Location
}
Repo 'C:\Users\AIXMOS\TMMT-canon'
Repo 'C:\Users\AIXMOS\CommandCenter\tmmt-os'
Repo 'C:\Users\AIXMOS\AIXMOS-Brain'

Section 'TMMT FEATURE FILES (Claude 2026-08-25)'
$feat = @(
  'C:\Users\AIXMOS\TMMT-canon\src\app\(admin)\tasks\page.tsx',
  'C:\Users\AIXMOS\TMMT-canon\src\app\(admin)\admin-actions.ts',
  'C:\Users\AIXMOS\TMMT-canon\src\app\(admin)\maintenance\page.tsx',
  'C:\Users\AIXMOS\TMMT-canon\src\components\Sidebar.tsx',
  'C:\Users\AIXMOS\TMMT-canon\src\components\ui.tsx',
  'C:\Users\AIXMOS\TMMT-canon\src\lib\queries.ts',
  'C:\Users\AIXMOS\TMMT-canon\supabase\migrations\20260825_create_tasks.sql',
  'C:\Users\AIXMOS\TMMT-canon\docs\STATUS.md'
)
foreach ($f in $feat) {
    if (Test-Path -LiteralPath $f) { '[OK]   {0}' -f $f } else { '[MISS] {0}' -f $f }
}

Section 'COMMAND CENTER FILES'
foreach ($f in @(
    'C:\Users\AIXMOS\CommandCenter\MissionControl\TMMT-MISSION-CONTROL.ps1',
    'C:\Users\AIXMOS\CommandCenter\Home-Command-Center.html',
    'C:\Users\AIXMOS\CommandCenter\ops\ops.ps1',
    'C:\Users\AIXMOS\CommandCenter\ops\brain.ps1',
    'C:\Users\AIXMOS\Desktop\TMMT.bat',
    'C:\Users\AIXMOS\Desktop\OPS.bat',
    'C:\Users\AIXMOS\Desktop\BRAINIAC-HANDOFF.ps1'
)) {
    if (Test-Path $f) { '[OK]   {0}' -f $f } else { '[MISS] {0}' -f $f }
}

Section 'PARSE CHECK (ops + closed-loop + brain + mission control)'
$parseFiles = @(
    'C:\Users\AIXMOS\CommandCenter\ops\ops.ps1',
    'C:\Users\AIXMOS\CommandCenter\ops\brain.ps1',
    'C:\Users\AIXMOS\CommandCenter\ClosedLoop\closed-loop-check.ps1',
    'C:\Users\AIXMOS\CommandCenter\MissionControl\TMMT-MISSION-CONTROL.ps1'
)
foreach ($pf in $parseFiles) {
    $tok = $null; $err = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($pf, [ref]$tok, [ref]$err)
    if ($err) { '[FAIL] {0}  {1}' -f $pf, ($err | ForEach-Object { $_.ToString() } | Select-Object -First 3) }
    else { '[OK]   parse {0}' -f $pf }
}

Section 'USB STICKS (env presence only, no secrets printed)'
foreach ($letter in @('D','E')) {
    $root = "${letter}:\"
    if (Test-Path $root) {
        $envp = "${letter}:\TMMT-WORK\TMMT\.env"
        $hasEnv = Test-Path $envp
        '[OK]   {0} mounted  TMMT-WORK.env={1}' -f $letter, $hasEnv
    } else { '[--]   {0} not mounted' -f $letter }
}

Section 'PATH HAS OPS'
$opsOnPath = ($env:PATH -split ';' | Where-Object { $_ -match 'CommandCenter\\ops' })
if ($opsOnPath) { '[OK]   ops folder on PATH: ' + ($opsOnPath -join ', ') }
else { '[WARN] ops folder NOT on this process PATH (profiles add it for interactive shells)' }

Section 'DONE'
Write-Host 'Sweep finished.' -ForegroundColor Green
