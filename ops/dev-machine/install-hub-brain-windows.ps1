# 24/7 Windows home PC — full TMMT AI Brain hub (Ollama + Docker + automations).
# Run in PowerShell (Admin recommended for Ollama/Docker/winget).
param(
    [string]$AixRoot = "$env:USERPROFILE\dev\AIX-Command-Center",
    [string]$TmmtRoot = "$env:USERPROFILE\dev\TMMT",
    [string]$GitBranch = "main",
    [switch]$SkipOllama,
    [switch]$SkipDocker,
    [switch]$SkipModels,
    [switch]$SkipTasks
)

$ErrorActionPreference = "Stop"
$HubDir = Join-Path $PSScriptRoot "hub-brain"

Write-Host "========================================"
Write-Host " TMMT AI Brain Hub — Windows 24/7"
Write-Host "========================================"
Write-Host "  AIX:  $AixRoot"
Write-Host "  TMMT: $TmmtRoot"
Write-Host ""

# --- 1. Clone repos ---
function Ensure-Clone($url, $path, $branch) {
    if (-not (Test-Path "$path\.git")) {
        New-Item -ItemType Directory -Path (Split-Path $path -Parent) -Force | Out-Null
        git clone --branch $branch $url $path
    } else {
        Set-Location $path
        git fetch origin --prune
        git checkout $branch
        git pull --ff-only origin $branch
    }
}

Ensure-Clone "https://github.com/AIXMOS537/AIX-Command-Center.git" $AixRoot $GitBranch
Ensure-Clone "https://github.com/AIXMOS537/TMMT.git" $TmmtRoot $GitBranch

# --- 2. Node 20 ---
if (Get-Command fnm -ErrorAction SilentlyContinue) {
    fnm install 20
    fnm use 20
} elseif (Get-Command nvm -ErrorAction SilentlyContinue) {
    nvm install 20
    nvm use 20.0.0
}

# --- 3. Python + AIX venv ---
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Warning "Install Python 3.11+ from python.org, then re-run."
} else {
    $aixSys = Join-Path $AixRoot "AIX_AI_COMMAND_SYSTEM"
    if (Test-Path $aixSys) {
        Set-Location $aixSys
        if (-not (Test-Path .venv)) { python -m venv .venv }
        & .\.venv\Scripts\pip.exe install -q -r requirements.txt
        if (-not (Test-Path .env) -and (Test-Path .env.example)) {
            Copy-Item .env.example .env
            Write-Host "Created $aixSys\.env — add API keys."
        }
    }
}

# --- 4. CHUMMO / ops node deps ---
$chummo = Join-Path $AixRoot "ops\chummo-stack"
if (Test-Path (Join-Path $chummo "package.json")) {
    Set-Location $chummo
    npm ci 2>$null; if ($LASTEXITCODE -ne 0) { npm install }
}

# --- 5. TMMT automations .env ---
$tmmtEnv = Join-Path $TmmtRoot "AUTOMATIONS\.env"
$tmmtEnvEx = Join-Path $TmmtRoot "AUTOMATIONS\.env.example"
if ((-not (Test-Path $tmmtEnv)) -and (Test-Path $tmmtEnvEx)) {
    Copy-Item $tmmtEnvEx $tmmtEnv
    Write-Host "Created AUTOMATIONS\.env — add Supabase + GHL keys."
}

# --- 6. Ollama (native GPU) ---
if (-not $SkipOllama) {
    if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
        if (Get-Command winget -ErrorAction SilentlyContinue) {
            Write-Host "Installing Ollama via winget..."
            winget install --id Ollama.Ollama -e --accept-source-agreements --accept-package-agreements
        } else {
            Write-Warning "Install Ollama from https://ollama.com/download/windows"
        }
    }
    if (-not $SkipModels -and (Get-Command ollama -ErrorAction SilentlyContinue)) {
        Write-Host "Pulling default models (may take a while)..."
        ollama pull qwen2.5:7b
        ollama pull nomic-embed-text
        ollama pull qwen2.5-coder:14b
    }
}

# --- 7. Docker: Open WebUI + n8n ---
if (-not $SkipDocker) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Warning "Install Docker Desktop for Windows, then re-run with -SkipDocker removed."
    } else {
        Set-Location $HubDir
        if (-not (Test-Path .env) -and (Test-Path .env.example)) {
            Copy-Item .env.example .env
        }
        docker compose up -d
        Write-Host "Open WebUI: http://localhost:3080"
        Write-Host "n8n:          http://localhost:5678"
    }
}

# --- 8. Scheduled tasks ---
if (-not $SkipTasks) {
    & (Join-Path $HubDir "register-hub-tasks.ps1") -TmmtRoot $TmmtRoot -AixRoot $AixRoot -GitBranch $GitBranch
}

Write-Host ""
Write-Host "========================================"
Write-Host " Hub install complete"
Write-Host "========================================"
Write-Host "  Tailscale: name this PC home-pc"
Write-Host "  Secrets:   AUTOMATIONS\.env + AIX_AI_COMMAND_SYSTEM\.env"
Write-Host "  Manual:    .\hub-brain\run-brain-cycle.ps1"
Write-Host "  Fleet doc: ops\dev-machine\FLEET.md"
Write-Host ""
