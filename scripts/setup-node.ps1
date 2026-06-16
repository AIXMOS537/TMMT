<#
  setup-node.ps1 — one command to turn a Windows box (the "brainiac" PC) into an
  AIXMOS node. The PowerShell twin of setup-node.sh.

    powershell -ExecutionPolicy Bypass -File scripts\setup-node.ps1 -License AIXMOS-XXXX-XXXX-XXXX-XXXX
    powershell -ExecutionPolicy Bypass -File scripts\setup-node.ps1 -Apply -License AIXMOS-XXXX-XXXX-XXXX-XXXX -Role brainiac

  Dry-run by default; -Apply actually changes the machine. Uses winget when present.
#>
param(
  [switch]$Apply,
  [string]$License = $env:AIXMOS_LICENSE_KEY,
  [string]$Role = "brainiac",
  [string]$Model = "qwen2.5-coder:14b"
)
$ErrorActionPreference = "Stop"
function Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m){ Write-Host "[!] $m" -ForegroundColor Yellow }
function Step($m){ Write-Host "`n> $m" -ForegroundColor Cyan }
function Die($m){ Write-Host "[X] $m" -ForegroundColor Red; exit 1 }
function Have($c){ $null -ne (Get-Command $c -ErrorAction SilentlyContinue) }
function Run($block){ if($Apply){ & $block } else { Write-Host "  would run: $block" } }

Write-Host "== AIXMOS node setup (Windows) ==" -ForegroundColor White
Write-Host ("mode: " + $(if($Apply){"APPLY"}else{"DRY-RUN"}) + "  role: $Role  model: $Model")

# 1. License gate
Step "License"
if([string]::IsNullOrWhiteSpace($License)){
  Warn "No license key. Pass -License AIXMOS-XXXX-XXXX-XXXX-XXXX (or set AIXMOS_LICENSE_KEY)."
  if($Apply){ Die "A valid license key is required for -Apply." }
} elseif($License -match '^AIXMOS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$'){
  Ok "license format valid"
  if($env:AIXMOS_LICENSE_URL){
    try {
      Invoke-RestMethod -Method Post -Uri $env:AIXMOS_LICENSE_URL -TimeoutSec 8 `
        -ContentType 'application/json' `
        -Body (@{key=$License;host=$env:COMPUTERNAME;role=$Role}|ConvertTo-Json) | Out-Null
      Ok "license activated"
    } catch { Warn "activation endpoint unreachable — format ok, proceed (activate later)" }
  } else { Warn "no AIXMOS_LICENSE_URL — format-checked only (offline)." }
} else { Die "license key malformed. Expected AIXMOS-XXXX-XXXX-XXXX-XXXX" }

# 2. Prerequisites (winget)
Step "Prerequisites"
function Ensure($cmd,$wingetId){
  if(Have $cmd){ Ok "$cmd present"; return }
  Warn "$cmd missing"
  if(Have winget){ Run { winget install --id $wingetId -e --accept-package-agreements --accept-source-agreements } }
  else { Warn "winget not found — install $cmd manually." }
}
Ensure git    "Git.Git"
Ensure node   "OpenJS.NodeJS.LTS"
Ensure ollama "Ollama.Ollama"

# 3. Local model
Step "Local model"
if(Have ollama){ Run { ollama pull $Model } } else { Warn "install ollama, then: ollama pull $Model" }

# 4. Router config
Step "Router (LiteLLM)"
$root = (& git rev-parse --show-toplevel 2>$null); if(-not $root){ $root = (Get-Location).Path }
$ex = Join-Path $root "infra/litellm.config.example.yaml"
$cfg = Join-Path $root "litellm.config.yaml"
if((Test-Path $ex) -and -not (Test-Path $cfg)){ Run { Copy-Item $ex $cfg }; Ok "router config staged (edit tailnet IPs)" }
Write-Host "  start it:  litellm --config litellm.config.yaml --port 4000"
Write-Host "  then:      `$env:LITELLM_BASE='http://127.0.0.1:4000/v1'"

# 5. Gate hook
Step "Fact-check gate"
if(Test-Path (Join-Path $root ".githooks")){ Run { git -C $root config core.hooksPath .githooks }; Ok "pre-push gate wired" }

Step "You're set ($Role)."
Write-Host "  Join Tailscale (same tailnet). Big models / vLLM live here (BRAIN)."
Write-Host "  Full guide: docs/QUICKSTART.md + docs/OPERATOR-RUNBOOK.md"
if($Apply){ Ok "Node setup complete." } else { Warn "DRY-RUN only — re-run with -Apply." }
