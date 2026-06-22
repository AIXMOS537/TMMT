# OVERHAUL — The Build Configurator ("customize your business like a car")

> Tear the whole stack down to parts and bolt it back together better, per
> business and vertical — like an engine overhaul. Earn the **pink slip** (the
> title/ownership) as you climb. Inspired by configurators like
> [pinkslips.app](https://pinkslips.app/paul-h/solar-flare).

**Status:** v0.2 scaffolded · **Owner:** PROJECT X HAILMARY · **Lead:** PROJECT X HAILMARY
**Front door:** `bash scripts/garage` → `tools/garage/index.html`
**Data model:** `config/overhaul/catalog.json` (parts) + `config/overhaul/builds/*.json`
**Deployer:** `scripts/overhaul-deploy.sh` (dry-run by default)

> Naming note: "**Operation Overdrive**" is reserved for a separate product — the
> emergency-response / medical-courier fleet (see `docs/OPERATION-OVERDRIVE.md`).
> This configurator is **OVERHAUL**; its UI is **The Garage**.

---

## Why this exists (the homage)

Built in homage to the Owner, his father's passion, and his two brothers laid to
rest — **رحمهم الله، اللهم اجعلهم من أهل الجنة.** Cars are the love language: a
thing you take apart, understand, tune, and make your own. OVERHAUL turns *a
whole business* into that — something anyone can start, customize, and own.

A second-chance machine: start where you are, **start the car, warm up the
engine**, go 0→100 — learn, earn, adapt. Build your physical character and your
digital avatar from scratch. Everyone willing to help themselves first is welcome.

---

## The idea, concretely

A business = a **car you spec out**:

| Car concept | OVERHAUL equivalent |
|---|---|
| Model | **Vertical** — rentals, credit-guidance+funding, e-commerce, Operation Overdrive |
| Trim / tier | **Tier** — the OFFER-STACK ladder ($1,875 → $100K) |
| Parts (engine, trans, ECU) | **Parts** — brain DB, local LLM, agents, dashboard, voice, security, sync |
| DLC / aftermarket | **Vertical packs** unlocked by tier (gamified) |
| Driver profile | **Avatar** — callsign, level, unlocked DLC; levels up by results |
| Pink slip (the title) | **Ownership** — earned as the operator delivers (learn→earn→churn) |

Sits **on top of** what exists — OPK (node kit), OFFER-STACK (tiers/verticals),
the brain (`seal-brain-local.sh`), Mission Control/Cockpit/Wiki (`tools/`).

---

## v0.2 focus: multi-business SYNC (TMMT ↔ MoeLegacy)

The real job: two businesses that **already make money** — TMMT (owner) and
**MoeLegacy** (Umar), each with their **own GHL + setup** — need to stay in sync
and work together, no matter the job. New `sync` category parts:

| Part | What it does | Maps to |
|---|---|---|
| `mesh-sync` | git-coordinated sync across every node/business | `scripts/sync-machine.sh`, `docs/MESH-SWARM.md` |
| `shared-brain` | both businesses write to one memory fabric | `supabase/migrations/20260616000000_memory_fabric.sql` |
| `ghl-bridge` | each keeps its OWN GHL; bridge syncs leads/pipeline across orgs | `scripts/ghl-sync-vercel-env.mjs`, `docs/GHL-WEBHOOK-SETUP.md` |
| `cross-org` | org-scoped roles/reads — shared mesh, fenced apart | `supabase/migrations/20260616500000_multitenant_hardening.sql` |

**Open discovery (needs owner input before building the GHL bridge):** which GHL
objects sync (contacts / leads / pipeline stages / appointments), in which
direction, and which business is source-of-truth per object. No guessing.

---

## Architecture

```
config/overhaul/
  catalog.json          # parts catalog (categories, parts, tiers) — single source of truth
  builds/*.json         # saved builds: model + tier + parts + avatar
tools/garage/index.html # The Garage — visual configurator
scripts/garage          # serves + opens The Garage
scripts/overhaul-deploy.sh  # maps each part → the real script (dry-run default)
```

**Add a part** = one entry in `catalog.json` + one `case` arm in
`overhaul-deploy.sh`. Every part `maps_to` a real file — nothing vaporware.

**Gamification:** tiers carry a `level`; parts carry `tier_min`. The Garage locks
higher parts until your tier unlocks them (DLC). Avatar ring fills with level.
Results → tier up → new parts unlock.

---

## Legacy finds (from MoeLegacy) — to port {#legacy-finds}

Make these **universally flash-deployable**. Each is a `to-port` part until wrapped:

| Find | What | Port plan |
|---|---|---|
| **SuperWhisper** | local voice dictation | `voice` part → brain-dump + hands-free. Confirm license before bundling. |
| **Clean UI / dashboard** | cleaner dashboard seen on desktop | Identify source, reconcile with `tools/launcher` + TMMT admin, port good parts. |
| **OpenClaw / OpenClaude** | open agent tooling | Portable module pointing at local Ollama by default. |
| **"Free API keys"** | keys on the machine | **DO NOT redistribute** — use the provider layer (below). |

> Port requires confirmed ownership/authorization of MoeLegacy + a consented
> inventory. Capture each tool + its license; never copy secrets.

---

## Security (non-negotiable)

- **No harvested keys.** Default provider = local Ollama (free); cloud =
  bring-your-own, scoped, rotatable per node. Found keys are never propagated.
- **Owner-only parts** (e.g. `hailmary-proxy`) require `auth/OWNER.seal`.
- **Mesh-only.** Tailscale, no public IP/funnel; brain DB binds `127.0.0.1`.
- **Compliance:** credit = "guidance," never "repair"; no guaranteed outcomes.
- **Dry-run first.** `overhaul-deploy.sh` changes nothing without `--apply`.

---

## Roadmap

- **v0.1:** catalog + builds + Garage UI + dry-run deployer. ✅
- **v0.2 (now):** sync category (TMMT↔MoeLegacy) + Operation Overdrive registered. ✅
- **v0.3:** wire `--apply` for the chosen pilot; GHL-bridge discovery → build; port SuperWhisper.
- **v0.4:** avatar persistence + results-driven level-ups from the brain.
- **v0.5:** publish into `aixmos-kit` so any node can `garage` → build → flash.
- **v1.0:** per-vertical DLC marketplace; BUILD-once + RUN-monthly billing tie-in.

---

## Try it

```bash
bash scripts/garage          # opens The Garage
bash scripts/overhaul-deploy.sh --tier host --parts "local-llm,brain-db" --dry-run
```
