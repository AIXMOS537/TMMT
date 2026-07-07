# Backend Lock & Installation Licensing

**Date:** 2026-06-16
**Goal (owner):** nobody can get into the backend — or learn how the system was
built and set up — unless they paid for the **full $50k installation**, received
the **full laptop**, and completed **setup + comprehension + activation**. A
single **supercomputer** ships with everything pre-loaded but **locked** until
the same gates pass.

---

## Honest threat model first

There are two different things being protected, and they need different tools:

| What you're protecting | Can a DB lock do it? | What actually protects it |
|---|---|---|
| **Running the backend** (using the admin/command/dispatch app) | ✅ Yes | The installation license + middleware gate (this doc). |
| **Reading how it was built** (source code, schema, setup) | ❌ No | A *deployment posture*: don't ship source; run server-side or as a sealed/encrypted appliance. |

A license check can refuse to *run* the app until activated. It **cannot** stop
someone who physically holds the source files from reading them. So "they can't
see how it's built" is achieved by **how you ship**, not by a column in a table.
Both halves are covered below.

## Part 1 — The enforceable runtime lock (BUILT)

Migration `supabase/migrations/20260616300000_installation_licensing.sql`:

- **`installations`** — per-org, **hardware-bound** license:
  `org_id`, `hardware_uuid`, `tier` (`full_install_50k`), `status`
  (`locked → provisioning → setup → comprehension → active`), and the gate
  timestamps `paid_at`, `setup_completed_at`, `comprehension_passed_at`,
  `activated_at`, plus `license_key`. RLS: only provider staff can read it;
  client-org users can't see license internals.
- **`backend_unlocked_for(user)`** — SECURITY DEFINER gate function:
  - **Owner/provider (`profiles.role='admin'`) is ALWAYS unlocked** — you can
    never lock yourself out (enforced in SQL, not just app code).
  - Everyone else: their org must have an installation that is `active` **and**
    `paid_at` **and** `setup_completed_at` **and** `comprehension_passed_at` —
    all four. Miss any one → locked.
- **Middleware gate** (`middleware.ts`, opt-in via **`BACKEND_LOCK_ENABLED=true`**):
  authenticated non-owner users on any non-public path are redirected to
  **`/locked`** unless `backend_unlocked_for` returns true. The `/locked` page
  reveals nothing about the system.

**Shipped OFF by default.** `BACKEND_LOCK_ENABLED` is unset, so nothing locks
today. Flip it to `true` once client orgs + installations exist — this prevents
accidentally locking your own running app before licenses are seeded.

### Activating an installation (the lifecycle)
1. Create the `installations` row for the client org + their device `hardware_uuid` (`status='provisioning'`).
2. Mark `paid_at` when the $50k is paid.
3. Mark `setup_completed_at` when install/setup is done.
4. Mark `comprehension_passed_at` when they pass the comprehension sign-off (tie to operator training completion).
5. Set `status='active'`, `activated_at=now()`. Backend unlocks for that org only.
   Suspend/revoke flips `status` back and re-locks instantly.

## Part 2 — The deployment posture (what makes source unseeable)

The lock above gates *use*. To stop clients learning *how it's built*:

1. **Don't ship source.** Deliver a production build / standalone binary, never
   the repo. (Next.js standalone output, or run the backend on your infra.)
2. **Prefer server-side hosting.** The strongest option: the backend runs on
   *your* Brainiac/cloud, the client's laptop is a thin licensed client. They
   literally never possess the backend.
3. **Sealed appliance for the supercomputer.** Ships with everything pre-loaded
   but on an **encrypted volume**; the decryption/activation key is released
   only after payment + setup + comprehension. Before that, the disk is opaque.
4. **Hardware binding.** The license is tied to `hardware_uuid`; copying the
   image to another machine won't activate.
5. **Secrets stay server-side.** Service-role keys, `MEMORY_API_TOKEN`,
   `QUO_WEBHOOK_SECRET`, etc. live in your env, never in anything shipped.

## The $50k full installation tier

- Unlocks backend access (Part 1) **and** includes the full laptop.
- The supercomputer = the all-in-one: everything pre-loaded, **locked** until
  payment + setup + comprehension + activation, then the encrypted volume is
  released and the license set `active`.
- Maps onto the operator program: comprehension sign-off = the "learned to
  completion" gate already recorded for the teach-unlock rule.

## What only you can do
- Decide ship mode per client (server-hosted vs. sealed appliance).
- Seed `installations` rows and drive the lifecycle to `active`.
- Set `BACKEND_LOCK_ENABLED=true` once licenses exist.
- For the appliance: set up full-disk encryption + key-release on activation
  (OS-level; outside this repo).
