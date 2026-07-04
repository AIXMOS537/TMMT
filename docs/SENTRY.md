# The Sentry — PROJECT X HAILMARY stands watch

> The little brother (AIXMOS) serves the public. The big brother (HAILMARY)
> guards the gate. The Sentry is HAILMARY's watch: it never sleeps, never trusts,
> and assumes anyone at the perimeter means harm until proven otherwise. Its job
> is singular — **nobody compromises, corrupts, or misuses what the owner built.**

Run it: **`bash scripts/sentry.sh`** · runs itself every morning in the CEO brief.

---

## What the public can actually touch (the whole attack surface)

A secure system is one where you *know* every door. There are only these, and the
Sentry watches each:

| Door | The lock | Verified |
|---|---|---|
| **Public forms** (`/forms`) | zod-validated, length-capped, rate-limited (5/hr/IP), anon insert under RLS | ✓ |
| **Webhooks** (`/api/webhooks/*`) | every route **fails closed** — unset secret = 401, never allow-all | ✓ |
| **Cron** (`/api/cron/*`) | bearer/secret gated, fails closed | ✓ |
| **Admin writes** | table **allowlist** + authenticated staff only — no arbitrary table | ✓ |
| **Every protected route** | middleware tiered gate via `getUser()` (verified, not spoofable) | ✓ |
| **The database itself** | Row-Level Security — each tenant/role sees only its own rows | ✓ |
| **The browser** | CSP · HSTS · X-Frame · nosniff · Referrer · Permissions headers | ✓ |
| **Server secrets** | service-role key never reaches client code; `.env` only | ✓ |

## The doctrine (why it can't be quietly broken)

1. **Fail closed, always.** A missing secret never means "let everyone in." If a
   guard isn't configured, the door stays shut. The Sentry flags any code that
   would allow-on-unset.
2. **No door without a lock.** Add a new webhook with no auth check and the Sentry
   fails the perimeter on the next run. You can't *forget* to lock a door.
3. **Least privilege.** Public gets forms. Operators get scoped tools. Tenants get
   their own rows. The owner gets the brain. Nobody's reach exceeds their grant.
4. **Defense in depth.** Even if the app is bypassed, RLS defends the data. Even if
   a key leaks, rotation kills it. Even if a machine is taken, the master key
   isn't on it. No single failure opens everything.
5. **The watch is automatic.** The Sentry runs in the CEO brief every morning and
   on every boot. A regression surfaces in **🔴 ON FIRE** before the owner does
   anything else.

## What the Sentry checks (codified, so it never drifts)

`scripts/sentry.sh` re-runs the full audit as code:
- every webhook + cron route requires auth (no open endpoint)
- secrets fail closed (no allow-on-unset)
- middleware uses `getUser()` + rate-limits public POSTs
- admin writes are allowlisted + auth-gated
- RLS migration present
- security headers present (CSP/HSTS/X-Frame/nosniff)
- service-role key never in client code; browser client stays client-safe
- no unreviewed XSS sinks
- defers to `secret-scan.sh` (no leaked key) and `protect.sh` (identity/locks/confidentiality)

One verdict: **PERIMETER SECURE** or **BREACH RISK**. Green means every door is
locked. Red names the open one and the exact fix.

## Honest limits (so the watch stays real, not magic)

- The Sentry is **static analysis** — it proves the locks are *in the code*. It
  can't prove a secret is set in production (an unset secret = a dead endpoint, not
  an open one — fail-closed protects you either way). Confirm prod env separately.
- It guards *this* repo's surface. The mesh (Tailscale ACL), the accounts
  (`account-hardening.sh`), and the machines (`device-integrity.sh`) have their own
  guards — the Sentry points to them, doesn't replace them.
- Security is a practice, not a one-time win. The Sentry's value is that it runs
  **every day**, so the practice can't lapse.

---

_Enforced by: `middleware.ts`, `src/lib/ghl/webhook-auth.ts` (fail-closed),
`src/app/(admin)/admin-actions.ts` (allowlist), `supabase/migrations/*` (RLS),
`next.config.ts` (headers), and the standing guards `protect.sh` / `secret-scan.sh`
/ `device-integrity.sh`. Watched by `scripts/sentry.sh`. HAILMARY obeys only the
owner._
