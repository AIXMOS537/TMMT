# VA Agent Runbook — Live AI Support

**Owner runs once each morning** (or after new leads land). VAs do **not** need Terminal.

## Start everything (owner, 2 min)

In **Terminal**:

```bash
bash ~/dev/AIX_Command_Center/scripts/start-va-agents-live.sh 15
```

That will:

1. Pull leads from **Supabase** `incoming_leads`
2. Run **CHUMMO** — outbound SMS/DM draft (section 1 in each file)
3. Run **MOOSE** — full client pathway / action plan (section 2 — same format as Maria IG credit plan)
4. Save packs under **`OPERATIONS/VA_LEAD_DRAFTS/YYYY-MM-DD/`**
5. Open **CHUMMO**, **MOOSE**, and **BRAIN** in separate Terminal windows (managers only)

### Regenerate options

| Command | When |
|---------|------|
| `node chummo-draft-leads.js --limit 15` | New day or new leads — CHUMMO + MOOSE |
| `node chummo-draft-leads.js --pathway-only --limit 15` | Drafts exist — refresh MOOSE plans only |
| `node chummo-draft-leads.js --limit 15 --no-pathway` | Messages only, no action plan |

Run from: `~/dev/AIX_Command_Center/ops/chummo-stack`

## Which VA uses which agent

| VA role | Agent / tool | What they get |
|---------|----------------|---------------|
| **Pipeline & Sales** | CHUMMO + MOOSE | Each lead file: **§1 send message** + **§2 execute pathway** + checklist |
| **Fleet & Rentals** | TANK (TMMT OS) | Case checklists on `/internal/dashboard` — assign maintenance from COMMAND_CENTER |
| **Client Experience** | CHUMMO (welcome) | Post-payment messages — same folder when status = paid |
| **Data & Reporting** | STICKS / brief | `DAILY_BRIEF_*.md` + COMMAND_CENTER metrics — Sunday 8PM report |
| **Content** | MOOSE | GHL/social automation ideas — manager runs MOOSE in Terminal |
| **COO** | BRAIN | Daily priorities + delegation — manager runs BRAIN in Terminal |

## VA rules (non-negotiable)

1. **Never auto-send** AI drafts — owner or manager approves first.
2. **English only** in team ops chat (see `VA_SETUP_TODAY.md`).
3. Personalize section 1 with one real detail from notes before sending.
4. Section 2 is the **execution bible** — check off operator items same day.
5. Log sends in the shift template (Bookings → follow-ups sent).

## Pipeline & Sales — daily flow

1. Open today's folder: `VA_LEAD_DRAFTS/YYYY-MM-DD/INDEX.md`
2. Open lead file → read **§1 CHUMMO** → approve → send in GHL/WhatsApp
3. Execute **§2 MOOSE** steps (GHL tags, calendar, call prep) — owner helps on Executive steps
4. Check off **Operator checklist** at bottom of file
5. Update lead status in GHL / TMMT OS after each milestone

## Interactive MOOSE (one-off pathway like Maria)

Owner/manager in Terminal:

```bash
cd ~/dev/AIX_Command_Center/ops/files && node moose.js
# Pick mode 1 — Build client pathway
```

Or batch from leads: `node chummo-draft-leads.js --limit 5`

## Interactive CHUMMO (one-off message)

```bash
cd ~/dev/AIX_Command_Center/ops/chummo-stack && bash start-mac.sh
```

## GHL automation (optional)

When `GHL_WEBHOOK_SHARED_SECRET` is set, webhook runs on port **4099** and can draft into GHL custom fields. See USB path:

`FlashDrive-Sync/LEXAR-AIX-HOME-PC/AIXMOS-AGENTS/membership/services/chummo-ghl-webhook/README.md`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| No drafts folder | Add Supabase keys to `TMMT MANAGEMENT/tmmt-os/.env.local` |
| Empty drafts | Run with `--limit 20` or check `incoming_leads` in Supabase |
| MOOSE section missing | Re-run with `--pathway-only` or full batch without `--no-pathway` |
| AI error | Start Ollama: `ollama serve` or set `ANTHROPIC_API_KEY` |
| VA can't open Terminal | They only use the **VA_LEAD_DRAFTS** folder — not agents directly |
