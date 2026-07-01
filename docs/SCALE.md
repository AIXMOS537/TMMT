# Scale — the mass-production line

> What it takes to go from one business to many — fast, clean, repeatable. The
> code is **production-verified** (build is green). New businesses are **one command**.
> The only per-business work left is provisioning their own cloud accounts.

---

## ✅ Already cleared (not blockers anymore)
- **Production build is GREEN** — the app deploys. Verified `npm run build`. It scales.
- **New business = one command** — `scripts/new-business.sh` builds a whole deployable,
  branded, isolated business from the verified codebase.
- **Branded sign-in per vertical** — `docs/PORTAL-SIGNIN.md` (1 config entry + env).
- **Multi-agency** — any business under X's or Moe's GHL agency runs isolated
  (`docs/GHL-MULTI-AGENCY.md`).
- **Onboarding + grant at scale** — send a file → they onboard → one-tap grant.
- **Compliance guardrail** — ads/claims can't go out illegal (auto-blocked).
- **Owner-only assets sealed** — Sealed Truth, master key, brain never ship to anyone.

## The mass-production line (per new business)
```bash
bash scripts/new-business.sh "Business Name" --portal <id> --agency x|moe
```
→ creates `../business-<slug>/` with its own bundle + `.env` (portal set) + `LAUNCH.md`.
Then follow its `LAUNCH.md`: Supabase project → GHL sub-account → Vercel deploy → smoke test.
**Repeat for every business.** Same engine, infinite tenants, none can destabilize another.

## The only real bottleneck left = provisioning (needs YOUR accounts)
Each business needs **its own** Supabase + GHL sub-account + Vercel — those require
interactive logins under the right agency, so they can't be fully scripted from here.
The scaffolder makes it a 30-min checklist instead of a rebuild. To speed it further:
- Keep a **provisioning runbook** + templates per agency (X's / Moe's).
- As volume grows, an **operator (Justin-style)** or a small script using each
  provider's API can pre-create the sub-accounts in batches.

## To make THIS codebase the live production base (the one merge)
All this work is on a branch, kept local. To run it as the canonical production app
(so every new business builds from the latest), **merge to `master`** via a reviewed
PR — then `new-business.sh` always stamps out the newest version.

## The growth flywheel
1. `new-business.sh` stamps a business → provision (checklist) → live.
2. Operators (Red Hood, Justin, …) onboard via one file → granted → bring clients.
3. Compliance + standards keep it clean at any volume.
4. Each business isolated → stable → the empire grows without fragility.

---

_Engine: `scripts/new-business.sh`. See `docs/PORTAL-SIGNIN.md`, `docs/GHL-MULTI-AGENCY.md`,
`docs/LEGACY-DEPLOY-MOE.md`, `docs/GO-LIVE.md`._
