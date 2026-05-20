# Windows 24/7 AI Brain Hub

Runs on your **powerful home PC** only. MacBooks push code; this box runs inference, automations, and routers.

## What runs here

| Layer | Service | URL / notes |
|-------|---------|-------------|
| **Local LLM** | Ollama (native, GPU) | `http://localhost:11434` |
| **Chat UI** | Open WebUI (Docker) | `http://localhost:3080` (CHUMMO uses `:3000`) |
| **Automation** | n8n (Docker) | `http://localhost:5678` |
| **Daily ops** | Python in `AUTOMATIONS/SCRIPTS/` | Scheduled 7am / 9am |
| **Command CLI** | `AIX_AI_COMMAND_SYSTEM` | Morning operator task |
| **Agents** | `ops/chummo-stack` portal | `http://localhost:3000` at logon |

## One-command install

From `TMMT\ops\dev-machine` (PowerShell as Admin):

```powershell
.\install-hub-brain-windows.ps1
```

Options:

```powershell
.\install-hub-brain-windows.ps1 -SkipModels    # skip ollama pull (faster)
.\install-hub-brain-windows.ps1 -SkipDocker     # no n8n/Open WebUI yet
```

## Repos (cloned automatically)

| Path | Remote |
|------|--------|
| `C:\Users\<you>\dev\AIX-Command-Center` | AIXMOS537/AIX-Command-Center |
| `C:\Users\<you>\dev\TMMT` | AIXMOS537/TMMT |

## Secrets (copy from MacBook — never git)

1. `TMMT\AUTOMATIONS\.env` — Supabase, GHL webhook secret, TMMT_OPS_URL  
2. `AIX-Command-Center\AIX_AI_COMMAND_SYSTEM\.env` — Airtable, OpenAI, Supabase  
3. User env: `ANTHROPIC_API_KEY` for CHUMMO/brain agents  

## Tailscale

1. Install on home PC → name **`home-pc`**  
2. Set in `hub-brain\.env`: `N8N_WEBHOOK_URL=http://home-pc:5678/`  
3. MacBooks reach Ollama: `OLLAMA_HOST=http://home-pc:11434` (optional)

## Workers (i5, AMD×2, Surface)

Use `set-machine-role.ps1 -Role worker` — **code sync only**.  
Point heavy Ollama jobs at **`home-pc`** over Tailscale; do not run full brain on Surface.

## Manual test

```powershell
cd C:\Users\<you>\dev\TMMT
.\ops\dev-machine\hub-brain\run-brain-cycle.ps1
ollama list
docker ps
```
