# Environments — never a mix-up: DEV · TEST · PROD

> The clean separation so you and your team (operators, developers, vendors) can
> **edit and test freely without ever touching live by accident.** Three
> environments, one promotion path, and guards that make confusion impossible.

---

## 1. The three environments

| Env | Branch | Where it runs | Data | Who edits |
|-----|--------|---------------|------|-----------|
| **DEV** | `feat/*`, `claude/*` (per person) | your machine + **Vercel preview** (auto per branch) | dev/staging Supabase | anyone, freely |
| **TEST** | `staging` | a shared **staging** Vercel deploy | **staging** Supabase (fake/seed data) | promoted from DEV |
| **PROD** | `master` | live Vercel (tmmt-ops / command-center / aixmos-landing) | **prod** Supabase (real customers) | **owner approval only** |

Key idea: **every branch already gets its own isolated Vercel preview URL** — so each
person automatically has their *own* test-and-edit server. Nobody shares a sandbox,
nobody edits prod.

## 2. The one promotion path (changes only flow one way)

```
 DEV (your feature branch + preview URL)
   → open a PR
   → fact-check gate green (build/types/lint/secrets/compliance)
   → merge to  staging  → verify on the TEST server
   → ►► OWNER APPROVAL ◄◄
   → merge to  master  → PROD
```

Changes never skip a step and never go backward. A vendor/dev works only on their
branch; the worst they can break is their own preview.

## 3. The guards that make mix-ups impossible

- **`aixmos where`** — an unmissable banner: **DEV (green) / TEST (amber) / PROD (red)**,
  the branch, the path, and a warning if the remote isn't your AIXMOS537 GitHub. Run it
  anytime you're unsure; add it to your shell prompt so it's always on screen.
- **Pre-commit prod-guard** (`.githooks/pre-commit`) — **blocks any direct commit to
  `master`/`main`.** You physically cannot edit prod by accident; it tells you to branch.
- **Pre-push fact-check gate** (`.githooks/pre-push`) — nothing leaves a machine red.
- **Separate Supabase projects + env files** per environment — `.env.development`,
  `.env.staging`, `.env.production`. A dev key can't read prod customer data.

Install the guards on any machine: `aixmos hooks`.

## 4. No more "which checkout am I in?"

The confusion came from two clones (`~/TMMT` and `~/projects/TMMT`) + a stale alias.
The rule:

- **One canonical path per purpose.** Pick `~/TMMT` as your working copy. If you need
  parallel branches, use **named git worktrees** deliberately, not random re-clones.
- **`aixmos where` before you work** — it tells you path + branch + env in one glance.
- **One `aixmos`** — point the alias at one script: `alias aixmos='bash ~/TMMT/scripts/aixmos.sh'`.

## 5. Onboarding starts with THE MISSION

Anyone joining runs the interview — and it **opens with the mission and won't proceed
until they accept it**:

```bash
aixmos onboard            # shows config/mission.md → requires "I ACCEPT THE MISSION"
```

Then a thorough, role-scoped interview (role, what they'll own, skills, access needed,
their **first step**, agreement to the rules). It saves a **local profile the owner
reviews** — access is *granted by you*, scoped least-privilege per
`docs/IT-SUPPORT-TEAM-PLAYBOOK.md`, never automatic. New people land in **DEV** only;
TEST/PROD access is earned.

## 6. Setting up TEST + PROD (one-time, owner)

1. **Supabase:** create a second project = **staging**; keep the existing as **prod**.
   Put their keys in `.env.staging` / `.env.production` (never commit).
2. **Vercel:** set the production branch to `master`; previews auto-build every branch.
   (Optional: a dedicated `staging` project pinned to the `staging` branch.)
3. **Branch protection (GitHub):** require a PR + passing checks to merge to `master`.
4. **`aixmos hooks`** on every machine so the prod-guard + gate are active.

---

_Tools: `aixmos where`, `aixmos onboard`, `aixmos hooks`. See
`docs/OPERATOR-RUNBOOK.md`, `docs/VERIFICATION-MESH.md`,
`docs/IT-SUPPORT-TEAM-PLAYBOOK.md`, `config/mission.md`._
