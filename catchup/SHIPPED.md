# SHIPPED — built & pushed this catch-up (branch `claude/catchup-aixmos-tmmt-5wv942`)

Every item below is committed, pushed, and **green** (tsc clean · lint 0 errors ·
build passes · 218 tests). Additive only — no working file was deleted or rewritten.
For each: what it is, how to turn it on, and the part only you can do.

---

## 1. Owner-approval console — the driver's seat  ·  `/approvals`
**What:** the choke point where every customer message / charge / dispute / payout
waits for your YES. Owner-only page with Approve / Reject, backed by a real
`gated_actions` table + guarded server actions. No auto-approve path anywhere.
**Turn on:** apply the migration `supabase/migrations/20260628120000_gated_actions.sql`
to Supabase, then sign in as owner and open `/approvals`.
**Enforce it on outbound SMS:** set `OWNER_APPROVAL_ENFORCE=1` — B3's reply is then
**held** (logged with a `held_for_owner_approval` flag, not spoken back to the customer)
and recorded as a pending action in `/approvals`. Wired on the real path (the TwiML
reply in `api/agent/sms/inbound`), not just the `sendSms` primitive. Off by default.
Note: approving records the decision; auto-delivering the approved text is the next
step (it does not send on approve yet) — but nothing auto-sends without you, which is
the whole point.

## 2. M1 brain — go live and PROVE it  ·  `scripts/brain-live.sh`
**What:** one command on the carry Mac that starts Ollama, pulls the model, runs a
**real inference and prints the brain's own answer**, then wires the app at it.
Not "ready" — proven. Local-only, idempotent.
**Turn on (run on the Mac):**
```bash
cd ~/TMMT && git pull origin claude/catchup-aixmos-tmmt-5wv942 && bash scripts/brain-live.sh
```
Add `--coder` for the coding model, `--tailnet` to share it to your other nodes.

## 3. Local-first agent routing — stop burning paid tokens
**What:** the B3 SMS agent now tries the **M1 brain first** (zero token cost) and only
falls back to Anthropic on failure. This is the "afford more Claude" math — the volume
work runs free on your hardware.
**Turn on:** `brain-live.sh` sets `POCKET_BRAIN_URL` for you; or set `LOCAL_BRAIN_URL`
in `.env`. No local URL = cloud-only, unchanged. Force cloud with `LOCAL_BRAIN_DISABLE=1`.

## 4. Fleet Economics dashboard  ·  `/fleet-economics`
**What:** the WS1 cockpit — utilization (overall + of rentable), revenue per vehicle,
cost, net, and per-vehicle + fleet ROI, from your existing fleet / payments / expenses
tables. StatCards + revenue bars + sortable table + CSV export. Metric engine is
pure and unit-tested (11 tests), so the numbers are trustworthy.
**Turn on:** already live in the build — sign in as owner, open `/fleet-economics`.
Add an acquisition-cost column to fleet rows to light up ROI.

## 5. Baseline + map (earlier this session)
`ARCHITECTURE.md` (real structure + spine), `HEALTH.md` (baseline checks), `STATUS.md`
(full inventory), `PLAN.md` (ordered next steps), and a safe lint/type fix that took
lint from 1 error to 0. Staged (not merged) CTA-fallback patch in `catchup/staged-diffs/`.

---

## The one lever only you can pull (I can't, by design)
**Turn on money collection.** Paste your real GHL checkout links into
`AIXMOS/public/ghl-config.js` (or set `NEXT_PUBLIC_GHL_CHECKOUT_*`) and create the GHL
deposit products → first dollar. It touches your money account + a live surface, so it
stays with you. Everything technical behind it is done and wired.

## Still dark on purpose (legal gates — leave for you + Umar)
All WS2 credit/funding stays behind `false` gates in
`shared/compliance-gates/gates.config.json` until attorney sign-off + registrations.
Correct and unchanged.
