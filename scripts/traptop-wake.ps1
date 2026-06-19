# traptop-wake.ps1 — Windows version of the activation ritual.
# PROJECT X HAILMARY — 3-5 passphrase gate for TMMT Traptops on Windows.
# Run from PowerShell: .\scripts\traptop-wake.ps1
# Or double-click: TRAPTOP-WAKE.cmd (see below)
param([string]$Action = "wake")

$ROOT = Split-Path -Parent $PSScriptRoot
$SEALED_DIR = "$ROOT\.aixmos\sealed"
$GATE = "$SEALED_DIR\GATE.seal"
$PAYLOAD = "$SEALED_DIR\payload.enc"
$DORMANT_FLAG = "$SEALED_DIR\.dormant"
$ATTEMPTS_FILE = "$SEALED_DIR\.attempts"
$LOCK_FILE = "$SEALED_DIR\.lockout"
$MAX_ATTEMPTS = 5
$LOCKOUT_SECONDS = 1800

function Write-Header {
    Clear-Host
    Write-Host ""
    Write-Host "  +====================================================+" -ForegroundColor Cyan
    Write-Host "  |   TMMT TRAPTOP - PROJECT X HAILMARY               |" -ForegroundColor Cyan
    Write-Host "  |   STATUS: " -ForegroundColor Cyan -NoNewline
    Write-Host "DORMANT" -ForegroundColor Red -NoNewline
    Write-Host "                                 |" -ForegroundColor Cyan
    Write-Host "  |   Engine is encrypted. Speak the keys to wake.    |" -ForegroundColor Cyan
    Write-Host "  +====================================================+" -ForegroundColor Cyan
    Write-Host ""
}

function Get-PBKDFHash($combined, $salt) {
    $enc = [System.Text.Encoding]::UTF8
    $hmac = New-Object System.Security.Cryptography.HMACSHA256
    $hmac.Key = $enc.GetBytes($salt)
    $h = [BitConverter]::ToString($hmac.ComputeHash($enc.GetBytes($combined))).Replace("-","").ToLower()
    # 100 stretch rounds
    for ($i = 0; $i -lt 100; $i++) {
        $sha = [System.Security.Cryptography.SHA256]::Create()
        $h = [BitConverter]::ToString($sha.ComputeHash($enc.GetBytes("$h$salt"))).Replace("-","").ToLower()
    }
    return $h
}

function Check-Lockout {
    if (Test-Path $LOCK_FILE) {
        $locked_at = [long](Get-Content $LOCK_FILE)
        $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        $elapsed = $now - $locked_at
        if ($elapsed -lt $LOCKOUT_SECONDS) {
            $remaining = [math]::Ceiling(($LOCKOUT_SECONDS - $elapsed) / 60)
            Write-Host "  LOCKED OUT — try again in $remaining minutes." -ForegroundColor Red
            exit 1
        }
        Remove-Item $LOCK_FILE, $ATTEMPTS_FILE -ErrorAction SilentlyContinue
    }
}

function Record-Fail {
    $attempts = 0
    if (Test-Path $ATTEMPTS_FILE) { $attempts = [int](Get-Content $ATTEMPTS_FILE) }
    $attempts++
    Set-Content $ATTEMPTS_FILE $attempts
    $remaining = $MAX_ATTEMPTS - $attempts
    if ($attempts -ge $MAX_ATTEMPTS) {
        [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() | Set-Content $LOCK_FILE
        Write-Host "  DEVICE LOCKED for 30 minutes." -ForegroundColor Red
        exit 1
    }
    Write-Host "  Wrong. $remaining attempts remaining." -ForegroundColor Yellow
}

if (-not (Test-Path $DORMANT_FLAG)) {
    Write-Host "  Engine is already LIVE." -ForegroundColor Green
    exit 0
}

if (-not (Test-Path $GATE)) {
    Write-Host "  No GATE seal found. Seal this device first." -ForegroundColor Yellow
    exit 1
}

Check-Lockout
Write-Header

$gate_content = Get-Content $GATE
$parts = $gate_content -split ":"
$salt = $parts[0]; $count = [int]$parts[1]; $expected_hash = $parts[2]

Write-Host "  Speak the $count master passphrases." -ForegroundColor White
Write-Host ""

$phrases = ""
for ($i = 1; $i -le $count; $i++) {
    $p = Read-Host -Prompt "  Key $i of $count" -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($p)
    $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    if ([string]::IsNullOrEmpty($plain)) {
        Write-Host "  Key $i cannot be empty." -ForegroundColor Red
        Record-Fail; exit 1
    }
    $phrases = "$phrases:::$plain"
}

Write-Host ""
Write-Host "  Verifying..." -ForegroundColor DarkGray

$actual_hash = Get-PBKDFHash $phrases $salt

if ($actual_hash -ne $expected_hash) {
    Record-Fail
    Write-Host "  ACCESS DENIED." -ForegroundColor Red
    exit 1
}

# ── KEYS CORRECT ──────────────────────────────────────────────────────────────
Remove-Item $ATTEMPTS_FILE, $LOCK_FILE -ErrorAction SilentlyContinue
Write-Host ""
Write-Host "  Keys verified — waking engine..." -ForegroundColor Green

# lift dormant flag
Remove-Item $DORMANT_FLAG -ErrorAction SilentlyContinue

# start Ollama if installed
$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if ($ollama) {
    Start-Process ollama -ArgumentList "serve" -WindowStyle Hidden
    Write-Host "  Ollama started." -ForegroundColor Green
}

# run go.ps1 if present
if (Test-Path "$ROOT\scripts\go.ps1") {
    Start-Process powershell -ArgumentList "-File `"$ROOT\scripts\go.ps1`"" -WindowStyle Hidden
    Write-Host "  Engine started (go.ps1)." -ForegroundColor Green
}

Write-Host ""
Write-Host "  +============================================+" -ForegroundColor Green
Write-Host "  |   ENGINE LIVE - PROJECT X AIXMOS          |" -ForegroundColor Green
Write-Host "  |   TMMT Traptop is now active.             |" -ForegroundColor Green
Write-Host "  +============================================+" -ForegroundColor Green
Write-Host ""
