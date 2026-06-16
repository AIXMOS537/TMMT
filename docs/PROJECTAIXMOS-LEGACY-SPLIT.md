# ProjectAixmos — Legacy Edition (backend-less variant)

> **Purpose:** Define a self-sufficient, **managed-cloud-only** variant of the
> AIXMOS / TMMT stack that can be handed to **mod legacy** with **no dependency
> on the owner's self-hosted backend PC ("the brain"), NAS, or the local mesh.**
>
> The owner keeps the full mesh-connected build (NAS + AIXMOS core + always-on
> local node). Mod legacy gets a clone that runs entirely on managed services
> and can be operated end-to-end by AI agents / virtual assistants.

_Status: SPEC — materialization steps below are run by the owner or by a Claude
Code session running **locally on a machine with repo + cloud credentials**.
This cloud session cannot reach the NAS/mesh, so it defines the split; it does
not push to mod legacy's infrastructure._

---

## 1. The split in one line

| Edition | Backend | Who runs it | Dependency on owner |
|---|---|---|---|
| **Full (owner keeps)** | NAS (UGREEN 60TB Docker/nginx) + AIXMOS core + local mesh node, always-on | Owner, live & local, mesh from anywhere | n/a — this *is* the brain |
| **ProjectAixmos — Legacy** | **Managed cloud only:** Vercel + Supabase + GoHighLevel | Mod legacy + AI agents/VAs | **None** — no NAS, no mesh, no owner box |

The whole point: mod legacy's copy must keep working **even if the owner's brain
PC, NAS, and mesh are offline or unreachable.** Nothing in the Legacy edition may
call back to a self-hosted host.

---

## 2. What the Legacy edition INCLUDES

These run on managed services and are safe to hand off:

- **TMMT Ops** app (`tmmt-ops`) — daily rental ops, fleet, customers, payments, tickets.
- **TMMT Command Center** (`tmmt-command-center`) — owner/leadership hub & role portals.
- **AIXMOS landing/funnel** (`aixmos-landing`) — public marketing + membership intake.
- The Next.js monorepo app under `src/` (App Router, server actions, middleware).
- **Supabase** (Postgres + Auth + RLS) — managed; new isolated project for mod legacy.
- **GoHighLevel** — CRM, payments, automations (their own sub-account / location).
- Public form pipeline (`src/app/forms/*`), admin pages (`src/app/(admin)/*`).
- `packages/aixmos-core` **logic only** (cube, coach-engine, readiness, status-machine,
  audit-log, types) — as long as it talks to **Supabase**, not a local store/db.
- Docs needed to operate: ARCHITECTURE, DATABASE-SCHEMA, PIPELINE-FLOW, SUPPORT_RUNBOOK,
  GHL-* setup, DOMAIN-SETUP, THREE-APP-ECOSYSTEM.

## 3. What the Legacy edition EXCLUDES (stays with the owner / the brain)

Strip these before handing off — they are the self-hosted backend, the mesh, and
owner-only operational secrets:

| Path / asset | Why excluded |
|---|---|
| `AIXMOS/docker/` (`docker-compose.yml`, `nginx-*.conf`) | NAS self-host backend — the brain box |
| `AIXMOS/portal/`, `AIXMOS/files/` served **from NAS** | Move to managed hosting or drop; no `/share/AIXMOS/...` volumes |
| Any mesh / local-node config, always-on agent daemon, `~/AIXMOS-AGENTS/*` | Owner's live local node + mesh — not transferable |
| `packages/aixmos-core/src/store/`, `src/db/` if backed by a **local** store | Must repoint to Supabase, or exclude |
| `.claude.local.md` | Owner's personal/operational memory (already gitignored) |
| `scripts/setup-mac-imessage-bridge.sh`, `docs/MAC-IMESSAGE-BRIDGE.md` | Owner's Mac↔iMessage relay |
| `scripts/sync-airtable*.mjs`, `AIRTABLE_PAT` | Owner's Airtable migration tooling/secret |
| Owner Vercel `tmmt-c919`, `tmmt` legacy projects | Owner cleanup, not handoff |
| All owner `.env` secrets / service-role keys | Mod legacy provisions **their own** |

## 4. Materialize the Legacy edition (run locally, with credentials)

> Do this from a machine that has the repo + the ability to create new cloud
> projects. **None of this touches the owner's NAS/mesh.**

1. **New repo / clean clone**
   ```bash
   git clone <this repo> projectaixmos-legacy && cd projectaixmos-legacy
   git checkout -b legacy/init
   # strip the EXCLUDE set
   git rm -r AIXMOS/docker AIXMOS/portal AIXMOS/files \
            scripts/setup-mac-imessage-bridge.sh docs/MAC-IMESSAGE-BRIDGE.md \
            scripts/sync-airtable.mjs
   # remove owner-only memory if present
   rm -f .claude.local.md
   ```
2. **New Supabase project (theirs).** Run the migrations in `supabase/migrations/`
   against a **fresh** Supabase project owned by mod legacy. Confirm RLS is on
   (`20260331_enable_rls.sql`). They hold their own service-role key.
3. **New GHL sub-account/location** for their funnel + payments. Re-tag pipeline
   per `docs/GHL-PIPELINE-SETUP.md`. Point `aixmos-landing` env at it.
4. **New Vercel projects** under mod legacy's Vercel team — `legacy-ops`,
   `legacy-command`, `legacy-aixmos` (or single-app per `docs/ONE-APP-CONSOLIDATION.md`
   if they prefer one app). Set env from **their** Supabase/GHL only.
5. **Sever any self-host callbacks.** Grep the clone for NAS/mesh references and
   confirm none remain:
   ```bash
   grep -rIn -e "/share/AIXMOS" -e "NAS" -e "docker compose" -e "mesh" \
        --include=*.ts --include=*.tsx --include=*.mjs --include=*.json src packages
   ```
   Every hit must resolve to a managed service or be removed.
6. **Verify it stands alone.** `npm run build`, then smoke-test all three URLs.
   Power-test: confirm it serves with the owner's NAS/mesh **off**.
7. **Hand off:** transfer the new repo + Vercel + Supabase + GHL ownership to
   mod legacy. They now run it agents-first, self-sufficient.

## 5. Acceptance — "self-sufficient & sustainable"

- [ ] Build green on a clean clone with the EXCLUDE set removed.
- [ ] Zero references to NAS / `/share/AIXMOS` / mesh / owner local node.
- [ ] Runs with owner's brain PC, NAS, and mesh fully offline.
- [ ] Mod legacy holds all their own keys (Supabase, GHL, Vercel) — owner holds none.
- [ ] Operable by AI agents / VAs without escalating to the owner for routine work.

---

_See also: `docs/THREE-APP-ECOSYSTEM.md`, `docs/ONE-APP-CONSOLIDATION.md`,
`docs/FLASH-DEPLOY-RUNBOOK.md`._
