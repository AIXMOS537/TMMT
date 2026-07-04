# Ship Moe USB — no-lawyer path

You chose to defer attorney engagement and ship Moe with the v0 docs as-is. This
is the entire runbook from "today" to "Moe is live."

## Why the v0 docs work without an attorney

- The notice clause at the top of MPA / DPA / AUP is permissive: either party may
  propose amendments at any time. No false "30-day attorney review" promise.
- The kill-switch is the legal contingency: if Moe ever does something the
  contract doesn't cover, soft-disable → talk → restore OR hard-wipe → done.
- The audit log creates the paper trail for any contract claim later.
- Moe is a friend and the first deploy. You've calibrated the trust level
  appropriately for the architecture.

## The four user actions (everything else is done)

### 1. Drop owner-side secrets (5 min)

```bash
cp ~/Projects/TMMT/scripts/partner-deploy/partner-deploy.env.template ~/.config/tmmt/partner-deploy.env
chmod 600 ~/.config/tmmt/partner-deploy.env
$EDITOR ~/.config/tmmt/partner-deploy.env
```

Fill in:
- `SUPABASE_ANON_KEY` (from project Settings → API → anon public)
- `SUPABASE_SERVICE_ROLE_KEY` (from Settings → API → service_role)
- `TAILSCALE_API_KEY` (from https://login.tailscale.com/admin/settings/keys)

### 2. Apply the Supabase migration (10 min)

```bash
# Per [[project_supabase_migration_drift]] — diff first, never blind-replay
mcp__supabase__list_migrations           # confirm what's already applied
psql "$SUPABASE_DB_URL" -f ~/Projects/TMMT/scripts/partner-deploy/sql/20260609_partner_tenancy.sql
```

If you don't have `SUPABASE_DB_URL` handy, run it from the Supabase Studio
SQL editor instead (paste the whole file, click Run).

### 3. Run the dry-run (2 min)

```bash
~/Projects/TMMT/scripts/partner-deploy/tests/dry-run.sh
```

Must show 6/6 automated cases passing. If anything fails, stop — that's a
real bug to fix before any partner.

### 4. Issue + burn + ship Moe's USB (~30 min + mail time)

```bash
# A. Issue
~/Projects/TMMT/scripts/partner-deploy/owner/issue-license.sh \
  --partner=moe-legacy \
  --partner-name="Moe Legacy" \
  --partner-email="partner@example.com" \
  --challenge-phrase="$(openssl rand -hex 6)"

# B. Pre-install call (use script in _ARCHIVED-moe-handoff/01)

# C. Plug in a USB, formatted as exFAT or APFS, named AIXMOS-PARTNER

# D. Get a single-use Tailscale auth key from
#    https://login.tailscale.com/admin/settings/keys
#    (reusable=no, expiry=24h, tags=tag:partner-moe)

# E. Burn
~/Projects/TMMT/scripts/partner-deploy/burn-partner-usb.sh \
  --partner=moe-legacy \
  --tailscale-authkey=tskey-...

# F. Ship USB (hand-deliver if possible; signature-required mail otherwise)

# G. Send shipping email (template in _ARCHIVED-moe-handoff/03)

# H. When USB arrives, install call (script in _ARCHIVED-moe-handoff/02)
```

## Setup Tailscale ACL first (one-time, before step 4)

In Tailscale admin console (https://login.tailscale.com/admin/acls), merge the
JSON from `tailscale-acl.json` into your existing ACL config. Replace
`<NAS_TAILNET_IP>` with the actual NAS tailnet IP (run `tailscale status` on
the NAS to find it).

## What is NOT on this path

- No attorney research time
- No outreach emails to law firms
- No retainer signing
- No waiting for redlines
- No § 16-B "engagement on calendar before signing" gate
- No nudge chasing attorney status

## What still gets you protected

- Hardware-pinned license (Moe's Mac UUID + non-exportable Keychain key)
- One-shot install token (can't be replayed)
- Four-tier kill-switch (soft / hard / heartbeat-miss / legal hold) in your hand
- Cross-tenant RLS at the DB layer
- Full audit log of partner actions
- Narrow Tailscale ACL (Moe's Mac can't reach BRAINIAC, your other Macs, or other partners)
- v0 docs that hold up well enough for a trusted-friend deploy

## When to revisit the attorney question

Engage one when ANY of these is true:

- Partner #4 lands (the template starts being load-bearing; legal risk scales)
- Annual partner revenue crosses $250K (litigation exposure justifies fee)
- A dispute arises with any partner that the kill-switch alone can't resolve
- You start taking on partners outside your personal trust network

Until then, the docs you have plus the kill-switch you control are sufficient.

## Reminders that survive this session

- Scheduled task `moe-legacy-attorney-engagement-nudge` has been **repurposed**:
  it no longer chases attorneys. It now checks Moe install status and reports
  the next single action. Fires Monday 2026-06-16 09:00 ET.
- Memory pointer at `project_moe_legacy_no_lawyer_path` records this decision.

## If you change your mind and want an attorney later

The full engagement scaffolding is still on disk at
`~/Documents/Business/legal/moe-legacy/`:
- `attorney-shortlist.md` — 5 candidates with rationale
- `outreach-email-template.md` — ready to send
- `retainer-scope-of-work.md` — ready to attach

Nothing was deleted. Just deferred indefinitely.
