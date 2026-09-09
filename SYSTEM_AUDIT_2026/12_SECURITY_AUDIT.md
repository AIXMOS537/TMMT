# 12 · SECURITY AUDIT (defensive, read-only — nothing was exploited)

## Headline: 0 ERROR · 56 WARN · 4 INFO. RLS on 100% of 168 tables.

This is a **better-than-average** posture. The repeated hardening migrations are real security work, not theatre.

## Findings by severity

### 🟠 S-1 · MEDIUM — 12 `SECURITY DEFINER` functions callable by `anon` over REST
Callable unauthenticated at `/rest/v1/rpc/<fn>`, running with **definer privileges**:

| Function | Concern |
|---|---|
| `lead_to_active_customer()` | **Mutates business state** — promotes a lead to customer |
| `submit_customer_intake(name, phone, email, …)` | Writes intake; PII path |
| `auto_route_intake()` | **Trigger function** — should not be RPC-exposed |
| `on_new_lead()` | **Trigger function** |
| `notify_new_fleet_vehicle()` | **Trigger function** |
| `expense_fill_from_vehicle()` | **Trigger function** |
| `capture_lead_intake()` / `capture_form_intake()` | Intake writes |
| `is_platform_admin()` | Discloses privilege semantics |
| `acting_org_id()` / `org_id_for_host(host)` | **Tenancy enumeration** |
| `eval_money_rails(token)` | Token-gated; guarded |

**Impact:** unauthenticated writes and business-state transitions; anonymous mapping of the tenancy model.
**Why it exists:** migration `20260825222235_restore_anon_intake_with_input_caps` deliberately re-opened anon intake (with caps) after `harden_anon_insert_public_intake` locked it — public forms need to write. The *intent* is sound; the **blast radius is wider than intended**, because four trigger functions were exposed as a side effect.
**Fix:** `REVOKE EXECUTE … FROM anon` on the four trigger functions and the three identity helpers. Keep only the two capped intake functions. Verify public forms still submit.

### 🟠 S-2 · MEDIUM — 38 `SECURITY DEFINER` functions callable by `authenticated`
Includes `onboard_org_member(email, org_id, role)`, `tmmt_token_grant(org, amount, …)`, `operator_self_certify()`, `bg_check_decide(id, decision, notes)`, `request_handoff(…, commission_cents)`, `assign_unit(…)`.

**Any logged-in user** — including a `customer` or `vendor` — can call these directly, bypassing the UI. Several have internal guards (`guard_tmmt_token_spend`, `guard_referral_chain_and_revoke_ops_functions`, `close_commission_and_token_grant_authz_gap` were written for exactly this). **Whether every one is guarded is UNKNOWN** and is the highest-value follow-up: `onboard_org_member` (grants org membership), `tmmt_token_grant` (mints credits) and `bg_check_decide` (approves a background check) are the three to verify first.

### 🟡 S-3 · LOW — `outreach_touches`: RLS enabled, **no policy**
Fails closed → 0 rows readable → the outreach engine cannot record a touch. This is a **functional outage disguised as a security setting**, and the same class of bug the team already fixed for DNC (`dnc_readable_so_gate_fails_closed`, whose table comment documents that a missing SELECT policy made the gate **fail open** and "is exactly how it was broken until 2026-07-16"). That comment is the best security documentation in the repo.

### 🟡 S-4 · LOW — `customer_payments_snapshot_20260706`
Ad-hoc production snapshot, RLS on, no policy, 31 rows of **payment data**. Should be archived out of `public`.

### 🟡 S-5 · LOW — extensions in `public`
`pg_net` (can make outbound HTTP from the database) and `vector`.

### 🟡 S-6 · LOW — 3 functions with mutable `search_path`
`claim_agent_job`, `finish_agent_job`, `fail_agent_job` — the agent job worker RPCs (2026-08-31), added after the earlier `harden_*_search_path` sweep. Same defect class, newly reintroduced.

### 🟡 S-7 · LOW — leaked-password protection disabled.

### 🟢 S-8 — Secrets hygiene: **clean**
No credentials in tracked files. `.env.example` lists ~60 variable names with no values. A `pii-guard.yml` CI job scans every push against a `PII_DENYLIST` secret. Service-role usage is confined to server routes via `createServiceRoleClient()`.

## Not found (checked)
- ❌ No IDOR pattern in reviewed routes — org scoping is applied.
- ❌ No client-side-only authorization — RLS backstops everything.
- ❌ No committed secrets.
- ❌ No unsafe upload handler in reviewed code.
- ❌ No overprivileged AI write path — the SMS/voice agent has never run (0 conversations).

## Priority
1. **S-1** revoke anon EXECUTE on the 4 trigger functions + 3 identity helpers.
2. **S-2** audit `onboard_org_member`, `tmmt_token_grant`, `bg_check_decide` for internal authz.
3. **S-3** add the `outreach_touches` policy (also unblocks outreach).
4. S-6, S-7, S-5, S-4 — routine.
