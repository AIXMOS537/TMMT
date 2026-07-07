# Confidentiality & Lock Charter — owner-gated, private by default

> Two laws, non-negotiable:
> **(1) The how and why of everything built is confidential — owner IP. Nobody
> learns it.**
> **(2) Everything stays LOCKED until Muhammad Taha personally unlocks it** — from
> the Watchtower or a device he owns. Default state is LOCKED. Fail-safe.

---

## 1. Confidential by default — nobody learns the how/why

- The **architecture, specs, methods, and reasoning** live only in the **private
  repo** (`AIXMOS537/TMMT`). Verified access: **one collaborator — you (admin)**.
  No outside collaborator. No stranger has ever pushed. The "how/why" is sealed
  behind owner-only access.
- **Anyone who joins agrees to confidentiality at onboarding** — the interview now
  requires agreeing to *"keep everything confidential — never share how or why
  anything was built."* No agreement → no entry. Recorded in their profile.
- **What people receive reveals nothing.** The shareable onboarding files
  (`dist/onboard.command`, `dist/onboard.ps1`) contain **only** the mission + an
  interview — **zero architecture** (verified). Operators get scoped *tools*, never
  the blueprint.
- **Tiered knowledge:** clients/operators/vendors see only what their role needs
  (`docs/DATA-ACCESS-CHARTER.md`). The full build is owner-only.

## 2. Owner-gated unlock — LOCKED until you say so

- **Default = LOCKED / DARK.** Capabilities stay gated until the owner unlocks them.
- **Only Muhammad Taha unlocks** — via the **Watchtower** or a **device he
  personally owns**, authenticated by the **owner-seal** (the boss's passphrase;
  the secret itself is never stored — only a salted hash). Operators cannot
  self-promote or self-unlock.
- **Kill-switch ("go dark") is fail-safe:** anyone can pull it to lock everything
  down; **only the owner's word lifts it.** Protect-first always overrides.
- **No auto-unlock, ever.** No script, agent, or teammate can flip the lock. The
  little brother (AIXMOS) obeys the big brother (HAILMARY); HAILMARY obeys only the
  owner (and family, once learned).

## 3. The locks already standing (your real protection)

| Lock | What it guards |
|---|---|
| **Private repo, owner-only** | The how/why — nobody else can read it |
| **Owner-seal passphrase** | No one gets owner/unlock without your word |
| **Go-dark kill-switch + DARK guards** | One pull locks it all; only you lift it |
| **Tailscale ACL (least-privilege)** | Team reaches support surfaces only — never the brain/secrets |
| **Supabase RLS** | Each client sees only their own data |
| **Brokered, short-lived secrets** | No raw keys handed out; rotate on exposure |
| **Verify-gate + prod-guard** | Nothing ships or hits prod without passing + your approval |
| **Confidentiality on join** | Everyone is bound to secrecy before entry |

## 4. What stays owner-only vs. shareable

| Owner-only (never leaves) | Safe to share |
|---|---|
| Architecture, specs, migrations, the mesh design | The mission (`config/mission.md`) |
| `docs/*` build/strategy, `infra/*`, the brain | The onboarding files (`dist/*`) |
| Secrets, keys, the owner-seal | A person's own scoped tools (after grant) |
| HAILMARY (owner-private) | The Legacy product (managed, brain-gated) |

## 5. Your standing actions (only you can do these)

- [ ] **Revoke the Airtable token** (`pat8mah6…`) — the one live exposed secret.
- [ ] Set/confirm your **owner-seal** passphrase (so unlock requires your word).
- [ ] Keep the repo **private**; never add a collaborator without intent.
- [ ] Bind anyone who joins to confidentiality (onboarding does this automatically now).

---

_Honest note: confidentiality is enforced by access control + onboarding agreement +
the gates above — strong and real, but it is a practice, not magic. Keep the repo
private, rotate exposed keys, and hold the owner-seal close. Enforced by:
`infra/tailscale-acl.jsonc`, `supabase/migrations/*` (RLS), the owner-seal +
go-dark (Watchtower), `docs/DATA-ACCESS-CHARTER.md`, `docs/SECRET-ROTATION.md`._
