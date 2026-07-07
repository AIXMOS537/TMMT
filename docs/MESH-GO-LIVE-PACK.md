# MESH GO-LIVE PACK — Lead Engineer Playbook

**Authority:** PROJECT X HAILMARY · **Date:** 2026-07-04  
**Companion:** [`GO-LIVE-CANON.md`](GO-LIVE-CANON.md) · **Repo:** `~/projects/TMMT`

Send this file + the scripts folder to **every device** on your mesh. Each machine runs **one role command**, then FORGE runs the integration test.

---

## Priority stack — HARD → EASY (do in this order)

### Tier S — Calendar blockers (start today, finish when external systems respond)

| # | Task | Owner | Time | Blocks |
|---|------|-------|------|--------|
| S1 | **Twilio 10DLC** register brand + campaign for AIXMOS | You + Twilio | 1–4 weeks | First SMS on ads |
| S2 | **GHL checkout products** — Ops Kit, Command Kit, Dealer Bundle, **$97**, credit guidance | You in GHL UI | 2–4 hrs | `/kits`, `/build`, membership |
| S3 | **A2P Marketing campaign** in GHL Trust Center | You | 1–2 weeks | Bulk warm SMS |

### Tier A — Hard but you control (ship this week)

| # | Task | Device | Command |
|---|------|--------|---------|
| A1 | Paste GHL checkout URLs → Vercel `tmmt-ops` | CARRY + FORGE | `npm run ghl:sync-vercel` |
| A2 | Set `GHL_WEBHOOK_SECRET` + wire GHL workflow → prod webhook | CARRY (GHL UI) | see `docs/GHL-WEBHOOK-SETUP.md` |
| A3 | **Deploy** code (middleware + first SMS already in repo) | FORGE | `vercel --prod` |
| A4 | Set `organizations.twilio_inbound_number` for org **aixmos** | FORGE/Cloud | Supabase SQL editor |
| A5 | Twilio inbound webhook → `/api/agent/sms/inbound` | FORGE | Twilio console |
| A6 | Env on Vercel: `TWILIO_*`, `ANTHROPIC_API_KEY`, `GHL_*` | FORGE | Vercel dashboard |
| A7 | GHL closer tags + round robin workflow (`hot-ready-now`) | OPS + CARRY | `docs/CLOSER_PLAYBOOK_V1.md` §5 |

### Tier B — Medium (parallel once A3 deploys)

| # | Task | Device |
|---|------|--------|
| B1 | Turn on Meta/TikTok ads → `/lp/aixmos/lead-magnet` | CARRY |
| B2 | Credit front door ads → `/credit` | CARRY |
| B3 | `$97` member → Learn access (auth or public token) | FORGE |
| B4 | Operator blast → `/join` approved → `/operator/training` | FORGE |
| B5 | Partner pipeline → `/forms/dealer-apply` | OPS |
| B6 | Nightly call sheet | OPS | `python3 va-liberation/triage_leads.py` |

### Tier C — Easy (same day wins)

| # | Task | Command |
|---|------|---------|
| C1 | Pause broken GHL $203 dunning | GHL UI |
| C2 | Audit blockers | `npm run go-live` |
| C3 | GHL env check | `npm run ghl:check` |
| C4 | Prod smoke | `npm run smoke:prod` |
| C5 | Integration test | `bash scripts/mesh/go-live-integration-test.sh` |
| C6 | Mesh device boot | `bash scripts/mesh/go-live-device.sh --role <role>` |

---

## Mesh device map — who does what

| Node | Machine examples | Role flag | Responsibility |
|------|------------------|-----------|----------------|
| **CARRY** | Your daily Mac | `--role carry` | Approvals, GHL UI, ad spend, iMessage relay, unison status |
| **FORGE** | M1 Mac Pro / work Mac | `--role forge` | `npm run build`, `vercel --prod`, integration test, swarm agents |
| **BRAIN** | Brainiac 7 PC | `--role brain` | AI-OPS-STARTER Docker, Ollama, memory vault → Obsidian |
| **OPS** | Closer/setter laptops | `--role ops` | GHL floor, call sheets, pitch page checks |
| **CLOUD** | Claude/Cursor (no shell on your machines) | — | Code, Vercel/Supabase MCP, docs — **commits to git only** |

---

## One-time: join every device to the mesh

Run **once per machine** (replace name):

```bash
git clone https://github.com/AIXMOS537/TMMT.git ~/projects/TMMT   # if missing
cd ~/projects/TMMT
git pull origin master
bash scripts/swarm-join.sh --name carry-mac --email YOUR_EMAIL@DOMAIN
bash scripts/mesh/go-live-device.sh --role carry   # pick role per table above
```

Suggested names: `carry-mac`, `forge-m1`, `brainiac-7`, `ops-rida`, `ops-bibbs`

---

## Daily mesh rhythm (all devices)

```bash
cd ~/projects/TMMT
bash scripts/tmmt sync          # pull latest canon + code
bash scripts/tmmt fix           # security doctor
bash scripts/tmmt mesh          # who's online
```

**FORGE only (after owner approves deploy):**

```bash
npm run build
vercel --prod
bash scripts/mesh/go-live-integration-test.sh
```

**CARRY only (owner):**

```bash
bash scripts/mesh/unison.sh status
bash scripts/tmmt booyah        # full home base online
```

---

## Files & folders to sync across mesh

| Send / sync | Purpose |
|-------------|---------|
| `~/projects/TMMT/` (git) | **Canonical codebase** — only source of truth |
| `docs/GO-LIVE-CANON.md` | AI + human strategy |
| `docs/MESH-GO-LIVE-PACK.md` | This playbook |
| `scripts/mesh/go-live-device.sh` | Per-device boot |
| `scripts/mesh/go-live-integration-test.sh` | Client-ready test |
| Key flash drive `.env` | Secrets — **never git** — `scripts/bootstrap-carry-mac.sh` |
| `~/.config/tmmt/airtable.env` | Call sheet triage (OPS machines) |
| `~/projects/AI-OPS-STARTER/` | Brainiac stack (BRAIN only) |
| `~/projects/AIXMOS-AGENTS/` | Local agent runtime (BRAIN/FORGE) |

**Do NOT sync:** Moe Legacy folders, `_ARCHIVE`, duplicate command centers, `.env` via git.

---

## Swarm parallel build (FORGE — fast-track remaining code)

After canon is read, dispatch agents across the mesh:

```bash
cd ~/projects/TMMT
bash scripts/tmmt sync
bash scripts/swarm.sh add "GHL round-robin workflow doc for hot-ready-now tag"
bash scripts/swarm.sh add "Learn access token gate for $97 members"
bash scripts/swarm.sh add "Operator garage onboarding wizard spec"
bash scripts/swarm.sh add "Expand smoke-prod for /lp and /credit"
bash scripts/tmmt go 2    # 2 agents on THIS machine
# On second machine:
bash scripts/tmmt go 2    # 2 more agents = 4 parallel
```

Review finished branches as PRs → merge → FORGE deploys.

---

## Client demo script (integration test = dress rehearsal)

Run after deploy:

```bash
cd ~/projects/TMMT
bash scripts/mesh/go-live-integration-test.sh
```

**Live walkthrough for client:**

1. Open **`/lp/aixmos/lead-magnet`** on phone — must NOT hit login  
2. Submit test number — JSON `ok:true`; SMS within 60s if Twilio live  
3. Reply **YES** — Aida responds via inbound agent  
4. Show **`/credit`** intake — credit gate  
5. Show **`/kits`** — checkout buttons (GHL URLs must be real)  
6. Show **`/join`** — operator path  
7. GHL pipeline — tag `hot-ready-now` → closer assignment  

**Pass = integration test green + one live SMS round-trip.**

---

## Money without waiting on Twilio (today)

While S1 (10DLC) pending:

1. Run **`/credit`** and **`/forms/credit-funding-intake`** ads → human follow-up  
2. Set GHL checkout URLs → **`/kits`** and **`/build`**  
3. OPS runs **`triage_leads.py`** → call HOT bucket 9am  
4. Closers work GHL with tags from **`CLOSER_PLAYBOOK_V1.md`**

---

## Quarantine (mesh must ignore)

Moe Legacy · open source · fleet KPIs · lead scrapers · `TMMT-swarm` experiments for launch · duplicate repos

---

## Quick reference card (pin in Slack / iMessage)

```
CANON:     docs/GO-LIVE-CANON.md
BOOT:      bash scripts/mesh/go-live-device.sh --role forge
TEST:      bash scripts/mesh/go-live-integration-test.sh
AUDIT:     npm run go-live && npm run ghl:check
DEPLOY:    vercel --prod  (FORGE, owner OK)
MESH:      bash scripts/tmmt sync && bash scripts/tmmt mesh
```

---

*Lead engineer rule: one canonical repo, one deploy target (`tmmt-ops`), one integration test, one client journey. Everything else is noise until revenue.*
