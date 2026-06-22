# Airtight — the Barn Door Protocol (containment before power)

> For a system this capable (fleet `fanout`, a shared brain, prod access), "airtight"
> means: **no secret can leak, no unauthenticated service can face the public, and every
> high-power op passes an interlock first.** Brace the containment before the power flows.

## Live security posture (Supabase advisor, 2026-06-22)

**0 ERROR · 56 WARN · all EXTERNAL** — no critical holes. Breakdown:

| Count | Finding | Verdict |
|---|---|---|
| 40 | `authenticated_security_definer_function_executable` | Mostly read-only identity helpers (`is_staff`, `current_organization_id`, …). Broad advisory. **Do not mass-revoke** — RLS depends on these. Tighten the few that *write* (assign/claim) only after confirming internal auth. |
| 12 | `rls_policy_always_true` (anon INSERT) | **By design** — public intake forms (`incoming_leads`, `waitlist`, `tickets`, …) need anon INSERT. Insert-only, no read/update/delete. |
| 2 | `extension_in_public` (`pg_net`, `vector`) | Hygiene; move to a schema when convenient. Low risk. |
| 1 | `anon_security_definer_function` (`submit_customer_intake`) | Intentional public intake; verify it stays input-validated. |
| 1 | `auth_leaked_password_protection` OFF | ⭐ **Actionable, easy** — turn ON (see below). |

### The two genuinely actionable items (owner-side)
1. **Turn ON leaked-password protection** — Supabase → Auth → Policies → enable
   "Leaked password protection" (HaveIBeenPwned). One toggle.
2. **Review the write-capable SECURITY DEFINER functions** (`assign_lead_idle`,
   `claim_open_referral`, `assign_unit`, `accept_handoff`, …) — confirm each checks the
   caller's authority internally; revoke `authenticated` execute on any that don't.
   *Careful, per-function — never a blanket revoke (it would break RLS).*

## The containment model (in-repo, enforced)

### Bindings — the brain can't face the public
The unauthenticated LLM endpoints now **bind to the Tailscale IP (or `127.0.0.1`), never
`0.0.0.0`**:
- `setup-llm.sh serve` and `brain-router.sh` resolve the tailnet IP; if Tailscale is down
  they bind **local-only**. They will not listen on all interfaces.
- (The Next.js app dev server (`local-up`) binds `0.0.0.0` for mesh access — but it's
  **auth-gated** by middleware, a different risk class. Tighten to the tailnet IP later if
  desired.)

### The interlock — `tmmt barn`
`scripts/containment.sh` is the barn door. **CRITICAL** checks (a FAIL blocks power ops):
1. No secret files (`.env`, keys, `*service_role*`) tracked in git.
2. `.env` is gitignored.
3. No server secret (`supabase-service`, `SERVICE_ROLE`, `pocket-brain`, `token-ledger`)
   reachable from any `"use client"` bundle.
4. The brain/router never bind `0.0.0.0`.

**DEEP** checks (WARN): secret-scan clean, gitleaks present, hooks wired, owner seal,
DARK kill-switch available.

```bash
bash scripts/tmmt barn            # full readout (PASS / WARN / FAIL)
bash scripts/containment.sh --gate   # fast critical-only; non-zero exit on FAIL
```

### High-power ops pass the gate first
- **`tmmt fanout N`** runs `containment --gate` before unleashing the fleet (skipped on
  `--dry`). A containment FAIL aborts the launch.
- **`tmmt allin`** runs the gate as step 0 — it won't proceed if anything's leaking.
- **DARK** (`tmmt dark`) remains the hard kill-switch over everything.

## Known false positives (verified safe — not leaks)

`secret-scan` over-matches two non-secrets; both confirmed safe:
1. ✅ **Fixed** — `docs/TENANCY-FINISH-RUNBOOK.md` had `sbp_xxxxxx` (a placeholder);
   changed to `sbp_<paste-your-token-here>` so it no longer matches.
2. ⚠️ **Known FP** — `scripts/memory-mcp-server.mjs:18`
   `const API_TOKEN = process.env.MEMORY_API_TOKEN` is an **env reference, not a literal
   secret.** Team fix (their tool/file): teach `secret-scan` to skip `process.env` /
   `import.meta.env` right-hand sides (reduces FPs without ever hiding a hardcoded secret).
   Left as-is here — editing working code/scanner regex mid-containment isn't worth the
   side-effect risk, and it is **not a leak**.

## Layers of defense (the whole barn)

| Layer | Control |
|---|---|
| Secrets | gitleaks pre-push · `.env` gitignored · `secret-scan` · no client-side secrets |
| Network | brain bound tailnet/localhost only · Tailscale ACLs · no public LLM endpoint |
| Identity | owner seal · fenced operators · RLS (agency/sibling isolation) |
| Money | atomic/idempotent token + referral ledgers |
| Prod | additive + owner-shipped migrations · drift parity · prod writes need approval |
| Kill | `tmmt dark` stops everything; only the owner seal lifts it |
| Proof | `tmmt selftest` (won't crash) + `tmmt barn` (won't leak) |

## TL;DR

- **No critical DB holes.** Two easy owner toggles to go from solid to airtight.
- **The brain can't face the public** (tailnet/localhost binding, enforced).
- **Power ops brace first:** `fanout` and `allin` pass `containment --gate` before firing.
- **Prove it anytime:** `tmmt barn` (no leaks) + `tmmt selftest` (won't fold).
