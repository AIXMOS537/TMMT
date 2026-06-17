# Flash-Deploy & Cleanup Runbook

> One consolidated checklist to take the stack to a clean, deployable state and
> tee up the **ProjectAixmos — Legacy** handoff. Each step is tagged by **who/
> where** it runs, because the cloud Claude session is sandboxed to the repo and
> **cannot reach your Macs, the brain PC/NAS, or the mesh.**

**Legend:** ☁️ = a cloud Claude session can do it · 💻 = must run on a real
machine (your Mac / brain PC) with creds · 🌐 = web dashboard action.

_Last updated: 2026-06-16._

---

## 0. Current verified state (no action — context)

- ☁️ **Production = healthy.** `master` deploys are all `READY` (green) on Vercel.
- ☁️ **Noise:** `swarm-coord` branch auto-deploys are all `BLOCKED` (a preview
  every ~2 min). Not production — but should be muted (Step 2).
- The three production apps are **separate and intentional** — do **not** delete
  any as a "duplicate": `tmmt-ops`, `tmmt-command-center`, `aixmos-landing`.

---

## 1. Retire legacy Vercel duplicates 🌐💻

`tmmt-c919` and `tmmt` re-deploy the same repo on every push (parallel failed builds).

1. 🌐 Vercel → `tmmt-c919` → Settings → **Environment Variables**: copy any var
   missing from `tmmt-ops` / `tmmt-command-center` / `aixmos-landing`.
2. 🌐 Vercel → `tmmt-c919` → Settings → **Domains**: move custom domains to the
   correct app (`docs/THREE-APP-ECOSYSTEM.md`).
3. 💻 Then delete the two legacy projects:
   ```bash
   bash scripts/retire-vercel-duplicates.sh          # dry-run (preview)
   bash scripts/retire-vercel-duplicates.sh --apply  # removes tmmt-c919 + tmmt ONLY
   ```
   _(Needs the `vercel` CLI logged in — run on a machine, not the cloud session.)_

## 2. Mute the `swarm-coord` preview spam 🌐

The `BLOCKED` deploys every ~2 min come from auto-deploying the mesh coordination
branch. Stop them without touching production:

- 🌐 Vercel → **(each affected project)** → Settings → **Git** → **Ignored Build
  Step**, or **Production/Preview Branches**, and exclude `swarm-coord` from
  preview deploys. (Per-branch `git.deploymentEnabled` in `vercel.json` only
  takes effect from the branch being pushed, so the dashboard toggle is the
  reliable lever here.)
- Result: production keeps deploying from `master`; `swarm-coord` stops building.

## 3. Rotate the Airtable token 🌐💻  ← real security item

This is the genuine "protect myself" task. The owner's `AIRTABLE_PAT` is a
long-lived secret used by `scripts/sync-airtable.mjs`.

1. 🌐 Airtable → **Developer hub → Personal access tokens** → revoke the current
   PAT.
2. 🌐 Create a new PAT scoped to **only** the bases the sync needs (least
   privilege: `data.records:read` + the specific base, not all workspaces).
3. 💻 Update `.env` (`AIRTABLE_PAT=…`) locally and in any Vercel project that
   uses it (🌐 Settings → Environment Variables). Never commit it.
4. 💻 Verify: `node scripts/sync-airtable.mjs --dry-run` succeeds with the new token.

## 4. Mac iMessage bridge 💻 (owner's work Mac only)

Cloud sessions cannot reach a stdio MCP server on the Mac. Run **on the Mac**:

```bash
bash scripts/setup-mac-imessage-bridge.sh
```

Then 🌐/💻 grant **Full Disk Access** (System Settings → Privacy & Security) to
the Terminal/Claude app and restart it. Verify in a **local** Claude Code session
on the Mac. Full guide: `docs/MAC-IMESSAGE-BRIDGE.md`.

## 5. Pre-deploy gate ☁️/💻

```bash
npm run check-env   # validates .env + Supabase reachability (no secrets printed)
npm run build       # primary CI gate — must be green
npm run lint
```

## 6. Smoke-test the three live apps 💻

```bash
curl -sS -o /dev/null -w "ops login:  %{http_code}\n" https://tmmt-ops.vercel.app/login
SMOKE_BASE_URL=https://tmmt-command-center.vercel.app bash scripts/smoke-prod.sh
curl -sS -o /dev/null -w "aixmos:     %{http_code}\n" https://aixmos-landing.vercel.app/
```

All should return `200`. (`docs/THREE-APP-ECOSYSTEM.md` has the per-app matrix.)

## 7. Spin up the Legacy handoff 💻

Once the above is clean, follow `docs/PROJECTAIXMOS-LEGACY-SPLIT.md` to materialize
the backend-less **ProjectAixmos — Legacy** edition for mod legacy (managed-cloud
only; no NAS/mesh/brain dependency).

---

## What I (this cloud session) finished vs. handed you

| Done here ☁️ | Needs your machine 💻 / dashboard 🌐 |
|---|---|
| This runbook + `PROJECTAIXMOS-LEGACY-SPLIT.md`, committed & pushed | Vercel duplicate deletion (Step 1.3) |
| Verified prod = green, identified swarm-coord noise | Mute swarm-coord in Vercel UI (Step 2) |
| Documented exact Airtable rotation steps | Revoke + reissue the Airtable PAT (Step 3) |
| Scaffolded `setup-mac-imessage-bridge.sh` (earlier) | Run it on the Mac + Full Disk Access (Step 4) |
| Defined the Legacy split manifest | Materialize + hand off to mod legacy (Step 7) |
