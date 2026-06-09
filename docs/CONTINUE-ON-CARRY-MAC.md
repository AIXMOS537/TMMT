# Continue on the Carry Mac

Everything is committed and pushed to **`master`**. This is how to pick up on the
carry MacBook and keep going — using the **flashdrive as your key**.

## Where things stand (as of handoff)

- **All work is on `master`** — 11 PRs merged this session. Nothing is left
  uncommitted; the cloud branch is gone, GitHub is the source of truth.
- **Health:** 78 unit tests pass · `tsc` clean · `npm run build` clean ·
  `npm run lint` exits 0 · full route smoke 76/76.
- **Only open PR:** **#4** (decision: expose VIN/plate to partners — yes = merge,
  no = close).
- **What's left to do** lives in **`docs/ACTION-CHECKLIST.md`** (prioritized,
  tagged 🤖 code / 👤 your accounts / ⚖️ decision). The two that matter most are
  account-side and only you can do them: **A. lock down repo access** and
  **C. wire GHL → turn on payments** (`docs/HIGH-TICKET-GO-LIVE.md`).

## What shipped this session (so you remember the lay of the land)

- Revenue funnel: `/build` + `/build/reserved` (deposit checkout, unlisted),
  `/kits`, GHL→Supabase payment recording (idempotent, affiliate-attributed,
  balance-tracked).
- Owner views: `/revenue` (with a 6-month trend chart) and `/affiliates` payouts.
- Admin: maintenance inline status toggle, CSV export on all 19 tables,
  password reset, MissionBoard on the dashboard.
- Quality: Vitest (unit + jsdom component tests), lint to zero errors.
- Docs: `ACTION-CHECKLIST.md`, `QA-WALKTHROUGH.md`, `HIGH-TICKET-GO-LIVE.md`.

---

## First-time setup on the carry Mac (≈5 min)

### 1. Get the code
```bash
git clone https://github.com/AIXMOS537/TMMT.git
cd TMMT
```
(The repo is **private** — sign in first with `gh auth login`, or use SSH/a PAT.)

### 2. Plug in the key flashdrive and bootstrap
The flashdrive **is the key** — it carries your `.env` (Supabase + GHL secrets).
One command installs it, installs deps, and validates:
```bash
bash scripts/bootstrap-carry-mac.sh            # auto-finds the key drive
# or point it explicitly:
bash scripts/bootstrap-carry-mac.sh /Volumes/AIXMOS-KEY
```
That copies `secrets/.env` off the drive into the repo, runs `npm install`, then
`npm run check-env`.

### 3. Run it
```bash
npm run dev      # http://localhost:3000
npm test         # 78 unit tests
npm run build    # production gate
```

---

## Making / refreshing the key flashdrive

On a machine that already has a working `.env` (e.g. your work Mac):
```bash
bash scripts/make-key-flashdrive.sh /Volumes/AIXMOS-KEY
```
This writes your `.env` to `/<drive>/secrets/.env`. Re-run it whenever a secret
changes so the key stays current.

## 🔐 Security rules for the key flashdrive

- The key drive holds **live secrets** (Supabase service-role key, GHL secret).
  Treat it like a house key — keep it physically secure; don't leave it plugged
  into shared machines.
- **Owner-only.** Never give a key drive to an operator. Operator kits are
  **zero-secret** by design — operators sign into accounts you've granted, they
  never get `.env`/keys (see
  `docs/superpowers/specs/2026-05-26-operator-portable-kit-design.md`).
- `.env` is git-ignored (`.env*`), so it never lands in GitHub — the flashdrive
  is the only place the key travels.
- If a key drive is ever lost: rotate the Supabase service-role key + `GHL_WEBHOOK_SECRET`
  in those dashboards, then re-make the drive.

## Daily continuation

```bash
git pull origin master     # get the latest
npm install                # if deps changed
npm run dev
```
Pick the next item from `docs/ACTION-CHECKLIST.md` and go. Develop on a branch,
push, open a PR.
