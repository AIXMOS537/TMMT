# 🔖 BOOKMARK — where we are, on every device
> **The one file to read when you sit down at ANY machine.** Sync first (START-HERE → 6 UPDATE,
> or `bash scripts/tmmt sync`), then read this. Updated every working session — if you finish
> real work, update this file in the same commit. Last update: **2026-07-18**, branch
> `claude/tmmt-stack-overhaul-1l45nw`.

## The vision (unchanged, one paragraph)
TMMT Auto Services LLC runs two lines on one engine — **TMMT Rentals** (main; the fleet is the
asset) and **TMMT Auto Detail** (service line + internal turnover engine). Shipshape model:
the VEHICLE is the unit of care. Proactive not reactive, relationships not transactions,
recurring revenue on both lines, quiet automation, owner-approval on anything customer/money.
**Supabase is the system of record. GHL is customer comms. Quo is the team support line.
START-HERE is the only front door anyone needs.**

## ✅ DONE (this overhaul, shipped & pushed)
- **START-HERE front door** (`START-HERE.command`/`.cmd` → `scripts/start.sh`) — one menu,
  8 plain-English options, child-proof. Printable card: `tools/start-here-card/index.html`.
- **Declutter:** 9 duplicate/dead launchers → `archive/legacy-launchers/` (never deleted);
  `doctor.sh` repointed to real front doors.
- **Airtable quota burn killed:** `scripts/sync-airtable.mjs` disabled behind
  `AIRTABLE_SYNC_ENABLED=1` (legacy, destructive, quota-eating).
- **Detail line data model** (was: nowhere) → Supabase tables `customer_vehicles`,
  `detail_jobs`, `detail_memberships` with standard RLS.
- **Collections truth:** ~$7K+ quantified past-due, sorted safe-to-contact vs DND vs verify —
  Google Sheet "TMMT Collections Tracker (auto-built 2026-07)".
- **Lead net BUILT** (`docs/LEAD-NET-SPEC.md` → implemented):
  - DB (live now, site-independent): `incoming_leads.lane`, `lead_followups` clock table,
    auto-trigger on every new lead, pg_cron sweep every 15 min (escalates untouched leads),
    daily 9am ET Slack digest, `leadnet_config` on/off switches.
  - App code: `createGhlContact`/`createGhlContactTask` (src/lib/ghl/client.ts),
    intake→GHL bridge with phone dedupe + lane tags (src/lib/leadnet/net.ts, wired into
    /api/leads/webhook), inbound-message reply clock (webhooks/ghl route). Unit-tested.
  - Remaining: UI clicking + env vars → `docs/LEAD-NET-RUNBOOK.md` (~45 min, owner/team).
- **Phase 0 stack audit** complete across Airtable/ClickUp/Quo/Gmail/Calendar/Drive/
  Supabase/Vercel/Slack (findings summarized in session notes + below).

## 🟡 WAITING ON OWNER (the only blockers)
1. **GHL:** set "Rental in Progress (Payment Reminder)" workflow to **Draft** (bad $203 step).
2. **Vercel dashboard:** disconnect surplus projects (keep `tmmt-c919`), then `vercel --prod`
   when ready to go live. No paid plan needed.
3. **Arlington RFQ N1121-4** (Car Sharing, closes **Aug 21 5pm ET**): download
   `N1121-4_SUPPLIER.pdf` from the Oracle portal → hand to Claude → full bid gets drafted.
4. **Collections:** bless the outreach wording (see Tracker sheet) → team works it top-down.
5. Work `docs/LEAD-NET-RUNBOOK.md`: GHL env keys + click the workflows together
   (cadences ship as DRAFT), paste the Slack webhook into `leadnet_config`.

## 🔜 NEXT UP (in order)
1. Owner works LEAD-NET-RUNBOOK (45 min) → lead net fully live.
2. Populate detail tables + first membership tiers.
3. Fleet availability calendar + turnover blocks (Phase 3/4 of the overhaul script).
4. Re-light the website (after Vercel cleanup) — two doors: Rentals / Detailing.
5. Command dashboard + Monday brief.

## 💸 OUT WITH THE OLD — cost & clutter cuts
| Cut | Status | Saves |
|---|---|---|
| Airtable API upgrade | ✅ avoided (sync guarded; Airtable = legacy read-only, decommission when convenient) | plan upgrade $ |
| Vercel Pro | ✅ avoided (local-first + manual deploys; surplus projects to disconnect) | ~$20/mo+ |
| ClickUp lead-alert firehose (OPS+ADMIN dupes) | 🟡 turn off feed, archive lists | noise + seat time |
| ClickUp empty shells (Social Media, CUSTOMER POLICY, TICKET DEPT, MOE LEGACY) | 🟡 archive | clutter |
| Supabase `moe-legacy` project (paused, empty) | 🟡 delete when confirmed unneeded | clutter |
| `customer_payments_snapshot_20260706` stray prod table | 🟡 drop after collections reconciled | clutter |
| Airtable "TMMT Rentals (Copy)" + "TMMT OS" orphan bases | 🟡 archive/export when API resets | dup-data risk |
| Old launcher scripts | ✅ archived (9 files) | confusion |
| Duplicate Drive docs (old root vs Data Room) | 🟡 sweep later, low priority | confusion |

## Ground rules that never change
Archive, never delete · drafts before anything customer-facing · owner gate on money/legal ·
compliance flags stay locked · PII stays off cloud LLM contexts · update THIS FILE when you stop.
