# Integration Registry

Fill this out as each tool gets connected. Do not store API keys in this file.

**Last updated:** 2026-05-16

## Core Systems

| Tool | Purpose | Status | Notes |
|---|---|---|---|
| **Supabase** | Rentals ops DB, auth, daily brief source | **Live** | Brief + TMMT OS; project `uapxakmlwnpfsftfeezx` |
| **Vercel (TMMT OS)** | Production app + `/api/intake` | **Live** | https://tmmt-c919-two.vercel.app — redeploy after env / `next.config` changes |
| GoHighLevel | CRM, contacts, pipelines, messaging | **Partial** | Collections + speed-to-lead; overdue workflow spec in `AUTOMATIONS/GHL_OVERDUE_WORKFLOW_SETUP.md` |
| ClickUp | Tasks, assignments, due dates | Planned | Main task execution system |
| Airtable | Manual-friendly views and lightweight operations | Partial | Templates in `AIX_AI_COMMAND_SYSTEM/airtable_templates/`; optional sync |
| n8n | Automation router and webhooks | Planned | Portable stack in `AIXMOSXTMMT-OPS/` |
| Zapier | Backup connector layer | Planned | Use when faster than n8n |
| Slack | Credit business internal commands/updates | Planned | **Credit + funding only** — see `CHANNEL_STACK_GHL_WHATSAPP_SLACK.md` |
| Telegram | Owner command bot | Optional | Not primary stack; see `CHANNEL_SETUP_GUIDE.md` |
| WhatsApp | Car rental customer + lead messaging | Planned | **Through GHL only** — see `CHANNEL_STACK_GHL_WHATSAPP_SLACK.md` |
| iMessage | Quick capture | Planned | Use Apple Shortcuts or Mac relay |

## Mixed workflow (canonical)

| Layer | Tool |
|-------|------|
| Read truth | TMMT OS + Supabase (fleet, payments exceptions, cases) |
| Act (collections, SMS, pipeline) | GHL / OpenPhone |
| Daily owner queue | `daily_command_center.py` → `OPERATIONS/DAILY_BRIEF_*.md` |
| Investor metrics | `docs/INVESTOR_METRICS_SNAPSHOT.md` |

## Secrets Storage Rule

API keys, tokens, webhook signing secrets, and passwords should live in:

- Vercel project env (Production + Preview)
- n8n credentials manager
- Supabase secrets
- 1Password or another password manager
- local `.env` / `.env.local` files that are never committed

Never paste secrets into markdown docs, ClickUp comments, Slack channels, or AI chats.

## Vercel env (required for production)

| Variable | Scope |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production + Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production + Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Production + Preview (server only) |
| `INTAKE_WEBHOOK_SECRET` | Production + Preview (recommended) |

See `tmmt-os/docs/VERCEL_PRODUCTION_CHECKLIST.md` for Supabase Auth URLs and smoke tests.
