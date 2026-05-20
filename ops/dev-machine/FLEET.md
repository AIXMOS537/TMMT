# TMMT machine fleet

One git repo (`github.com/AIXMOS537/TMMT`). Each machine has a **role** — do not clone + `npm run dev` on every box.

## Topology

```
                    GitHub (main)
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    MacBooks          Home PC         Windows workers
    (dev/push)        (24/7 hub)      (light tasks)
         │               │               │
    Cursor, code    sync + cron      scripts, agents,
    Vercel deploy   optional local   n8n, automation
                    services         (no full Next dev)
```

## Roles by machine

| Machine | Role | TMMT path | Sync | Run dev server? |
|---------|------|-----------|------|-----------------|
| **MacBook(s)** | Primary dev, Cursor, deploy | `~/dev/TMMT` | pull on open / launchd optional | Yes, when coding |
| **Home PC (24/7)** | Hub — git mirror, scheduled jobs, heavy scripts | `C:\dev\TMMT` or `~/dev/TMMT` | Task Scheduler 15 min | Optional `npm run start` only if you host locally |
| **i5 workstation** | Worker | `C:\dev\TMMT` | Task Scheduler | No |
| **AMD workstations (×2)** | Workers / GPU tasks if needed | `C:\dev\TMMT` | Task Scheduler | No |
| **Surface Pro 4 (i7/16GB)** | Light worker / remote UI | `C:\dev\TMMT` | Task Scheduler | No — too weak for builds |

**Production app:** Vercel (`tmmt-ops.vercel.app`) — workers do not need Next.js running 24/7 unless you explicitly self-host.

## What runs 24/7 on home PC (Windows)

**Full AI Brain** — one installer:

```powershell
cd C:\dev\TMMT\ops\dev-machine
.\install-hub-brain-windows.ps1
```

| Component | Purpose |
|-----------|---------|
| **Ollama** (native GPU) | Local LLM — `qwen2.5`, `qwen2.5-coder`, embeddings |
| **Open WebUI** (Docker) | Chat/workbench at `:3000` |
| **n8n** (Docker) | Command router, GHL webhooks, workflows |
| **AUTOMATIONS/** Python | Daily command center, follow-ups, maintenance, overdue→GHL |
| **AIX_AI_COMMAND_SYSTEM** | Morning operator, Airtable/Supabase snapshots |
| **ops/chummo-stack** | CHUMMO portal/agents (optional at logon) |
| **Git sync** | Pull `AIX-Command-Center` + `TMMT` every 15 min |

Details: `hub-brain/README.md`

AMD workstations can use `OLLAMA_HOST=http://home-pc:11434` over Tailscale — not a second full brain.

Do **not** duplicate: Vercel deploy, Supabase migrations, or GHL webhook receivers on every machine — one source (Mac push + Vercel; n8n webhooks on **home-pc** only).

## Secrets

| Machine | Needs `.env.local`? |
|---------|---------------------|
| MacBook (deploy) | Yes — Vercel CLI, full dev |
| Home PC (hub) | Yes — if running automations against Supabase/GHL |
| Windows workers | Only if that box runs a specific script requiring keys |

Copy secrets manually; never git commit.

## Scripts

| OS | Bootstrap | Sync | Auto sync |
|----|-----------|------|-----------|
| macOS | `bootstrap-macos.sh` | `sync-machine.sh` | `install-launchd.sh` |
| Windows | `bootstrap-windows.ps1` | `sync-windows.ps1` | `install-scheduled-task.ps1` |

## Tailscale hostnames (example)

| Host | Suggested name |
|------|----------------|
| Office MacBook | `mac-office` |
| Home MacBook | `mac-home` |
| Home PC 24/7 | `home-pc` |
| Surface | `surface-worker` |

MacBooks SSH to `home-pc` for logs: see `TAILSCALE-SSH.md`.
