# Supabase Security Audit — 2026-06-15

> Read-only advisor scan of the production project (`uapxakmlwnpfsftfeezx`).
> **84 findings — 0 ERROR / 0 critical. All WARN or INFO.** No active data leak.

## Headline

The scary one from the old Slack recap — *"always-true RLS policies, any
authenticated session can SELECT all customer rows"* — **does not hold up.** The
10 "always-true" policies are all **anon INSERT** policies on public-form tables.
That is **intentional and correct**: the public forms must let anonymous visitors
submit. They are INSERT-only with-check policies, not SELECT — they do **not**
expose anyone's data for reading. **Do not "fix" these — it would break the
public lead / appointment / waitlist / ticket forms.**

| Tables with intended anon-INSERT (leave as-is) |
|---|
| appointments, background_checks, credit_funding_sessions, customer_inspection_photos, customer_intake_forms, incoming_leads, tickets, vehicle_handover, vehicle_onboarding_inspections, waitlist |

## Findings by type

| Level | Finding | Count | Verdict |
|---|---|---|---|
| WARN | `authenticated_security_definer_function_executable` | 48 | Review (many intentional) |
| WARN | `anon_security_definer_function_executable` | 20 | Review (some intentional) |
| WARN | `rls_policy_always_true` | 10 | **By design — leave** |
| WARN | `function_search_path_mutable` | 2 | Safe quick hardening |
| WARN | `extension_in_public` (pg_net) | 1 | Low priority |
| WARN | `auth_leaked_password_protection` off | 1 | **Quick win — enable** |
| INFO | `rls_enabled_no_policy` | 2 | Safe (deny-all); add policy only if needed |

## Action plan (prioritized, with safe/risky labels)

### A. Quick wins — safe, do first
1. **Enable leaked-password protection.** Supabase Dashboard → Authentication →
   Policies/Passwords → turn on "Leaked password protection (HaveIBeenPwned)".
   One toggle, no breakage. *(Dashboard only — no API/MCP for it.)*
2. **Pin function search_path** on `agent_open_load` and `pick_idle_closer`
   (`ALTER FUNCTION … SET search_path = 'public, pg_temp'`). Low risk; prepare as
   a reviewed migration (verify each function body first — don't blind-apply).

### B. Needs analysis — do NOT blind-change (would break production)
3. **SECURITY DEFINER function grants (20 anon + 48 authenticated).** The advisor
   flags every definer function, but several are *meant* to be callable:
   - **Keep public:** `submit_customer_intake` (public form), `license_heartbeat`,
     `provision_install_token`, `revoke_license`, `reinstate_license`,
     `bind_install` (API endpoints with their own auth), `tg_*` (triggers).
   - **Candidates to `REVOKE EXECUTE FROM anon/authenticated`:** internal ops like
     `rebalance_all_orgs`, `rebalance_stale_leads`, `assign_lead_idle`,
     `assign_va_to_operator`, `provision_operator`, `book_operator_commission`,
     `pick_idle_closer`, `claim_open_referral`, `offer_credit_crosssell` — *if*
     they're only ever called server-side with the service role.
   - **Action:** confirm each call path, then a single reviewed migration revokes
     anon/authenticated EXECUTE on the internal-only set. Prepared on request —
     not applied autonomously, because a wrong revoke breaks live flows.

### C. Low priority
4. `extension_in_public` (pg_net): moving it out of `public` can break references;
   defer unless required by compliance.
5. `rls_enabled_no_policy` (`enforcement_settings`, `operator_va_assignments`):
   RLS on + no policy = deny-all to anon/authenticated (safe). Add a read policy
   only if the app needs those tables client-side.

## Key rotation runbook (flashdrive is gone → rotate as precaution)

The lost key drive held live secrets. Rotate, then update Vercel, in this order
to avoid downtime:

1. **Supabase** → Project Settings → API Keys → reset the **service-role / secret**
   key. Copy the new value.
2. **GHL** → regenerate the webhook secret.
3. **Vercel** (all 3 projects) → Settings → Environment Variables → update
   `SUPABASE_SERVICE_ROLE_KEY` and `GHL_WEBHOOK_SECRET` (Production) → **Redeploy**.
4. **Any machine** → re-pull: `vercel env pull .env --environment=production`.

> Anon/publishable keys are public by design (they ship in the client) — only the
> **service-role** key and **webhook secret** are sensitive enough to rotate.

## What can be automated vs. owner-only

- **Owner-only (dashboard logins):** leaked-password toggle, key rotation steps 1–3.
- **Can be prepared for review here:** the search_path migration (A2) and the
  scoped REVOKE migration (B3) — applied only after you confirm call paths.
- **Already safe / no action:** the 10 anon-INSERT policies, the 2 deny-all tables.

_Generated from a read-only `get_advisors` scan. Re-run after any DDL change._
