# Security audit — Layer 3 (RLS / DB policies)

**Audit date:** 2026-06-10
**Method:** local migration files reviewed by a subagent, then cross-checked against prod via Supabase MCP (`list_migrations`, `pg_policies`, `get_advisors`).

## Headline

The Layer-3 subagent audit found 3 HIGHs against the **local** `supabase/migrations/*.sql` files. Cross-checking against prod showed that **most of those HIGHs are already closed by migrations applied directly to prod that are not in the local repo** (~95 prod migrations vs 14 local). The drift has been confirmed and updated in `[[supabase-migration-drift]]` memory.

This document records what's actually still open.

## What's already closed in prod

| Subagent claim | Prod reality | Closed by |
|---|---|---|
| `program_applications` + `program_audit_log` open to anon (`USING (true)`) | All policies require `is_staff() OR is_internal_ops()`. No anon policies. | `20260604005426_lock_program_tables_remove_anon_policies` |
| Legacy `auth_all_*` policies use `USING (true)` for authenticated | Prod uses `staff_all_*` policies with `is_staff()` predicate. No `USING (true)` on authenticated reads. | Multiple migrations replaced the originals |
| B3 agent tables not in local migrations | Live in prod and locked to `service_role` only (no anon/authenticated access). | `b3_create_audit_events`, `b3_create_agent_conversations_messages`, `b3_extend_*` |

## What's still open

### 🟡 MEDIUM — `operator_va_assignments` has RLS enabled but no policies

Effect: only `service_role` can read or write. If this is the design (service-role-only writes — same pattern as B3 agent tables), it's correct. If it was meant to be reachable by authenticated callers, the table is fully deny-all today.

**Action:** verify intent. If service-role-only is the design, add a comment policy that documents it. If authenticated access was intended, add the missing policies.

### 🟡 MEDIUM — 20 SECURITY DEFINER functions executable by `PUBLIC`

List: `assign_lead_idle`, `assign_va_to_operator`, `bind_install`, `book_operator_commission`, `claim_open_referral`, `create_affiliate_link`, `get_partner_fleet`, `license_heartbeat`, `offer_credit_crosssell`, `provision_install_token`, `provision_operator`, `rebalance_all_orgs`, `rebalance_stale_leads`, `reinstate_license`, `revoke_license`, `submit_customer_intake`, `tg_attrib_affiliate`, `tg_auto_assign_lead`, `tg_notify_handoff_slack`, `tg_validate_and_verify_lead`.

The `tg_*` triggers are invoked by other DB ops, not user calls, so the `PUBLIC` grant on them is theoretical risk only. The remaining ~16 functions need per-function analysis per `[[revoke-from-public-not-anon]]`: REVOKE FROM PUBLIC, then re-grant to the specific role(s) that legitimately need to call them. The `submit_customer_intake` case in particular is intentionally public-form-facing — it should keep `anon` after the `PUBLIC` revoke.

**Action:** open a migration per function (or one batched migration) that does `REVOKE EXECUTE ... FROM PUBLIC` followed by targeted `GRANT EXECUTE ... TO anon|authenticated`. Not safe to apply blind — each function needs a one-line check of which caller depends on it.

### 🟡 MEDIUM — 48 SECURITY DEFINER functions executable by signed-in users

Overlaps with the PUBLIC set above. Same remediation pattern. Same per-function analysis requirement. Most of these are legitimate (e.g. `license_heartbeat` SHOULD be callable by signed-in license clients), so this is not a blanket fix.

### 🟡 MEDIUM — `agent_open_load` and `pick_idle_closer` have mutable `search_path`

Both are SECURITY INVOKER (so the risk is reduced — they don't elevate privileges), but the fix is a one-liner:

```sql
ALTER FUNCTION public.agent_open_load(uuid) SET search_path = '';
ALTER FUNCTION public.pick_idle_closer(uuid) SET search_path = '';
```

**Action:** verify each function body fully-qualifies its table references (`public.foo`, not bare `foo`) before applying — otherwise `search_path = ''` will break them.

### 🟡 MEDIUM — Multi-tenant blast radius via bare `is_staff()`

Tables like `fleet`, `active_customers`, `customer_payments`, `insurance`, etc. use `is_staff()` with no `org_id` predicate. The system is now 3-tenant (AIXMOS / Moe Legacy / TMMT RENTALS per `[[three-tenant-live-2026-06-09]]`). A staff user of one tenant can read every other tenant's customer data.

This is the **strategic** Layer-3 finding — not a simple migration. Two paths:
1. Add `organization_id` columns + per-tenant predicates: invasive, table-by-table
2. Document that `is_staff()` is for owner / internal-admin only; tenant operators get a different role like `is_tenant_staff(org_id)`

**Action:** design discussion before any migration. Not safe to apply unilaterally.

### 🟢 LOW — Leaked Password Protection disabled

Supabase Auth setting, not a migration. Enable in Supabase dashboard → Authentication → Settings → "Check for compromised passwords against HaveIBeenPwned.org".

### 🟢 LOW — `pg_net` extension installed in `public` schema

Moving extensions between schemas is rarely-safe DDL — risk of breaking everything that calls into pg_net. Track but defer.

## What's intentional (do NOT change)

The Supabase advisor flags 10 "RLS Policy Always True" findings. Per `[[shield-audit-2026-06-07]]` these are by-design public-form INSERT patterns and must remain:

- `appointments.anon_insert_appointments`
- `background_checks.anon_insert_bg_checks`
- `credit_funding_sessions.anon_insert_credit_funding`
- `customer_inspection_photos.anon_insert_inspections`
- `customer_intake_forms.intake_public_insert`
- `incoming_leads.anon_insert_leads`
- `tickets.anon_insert_tickets`
- `vehicle_handover.anon_insert_handovers`
- `vehicle_onboarding_inspections.anon_insert_onboarding`
- `waitlist.anon_insert_waitlist`

Public forms POST to these tables anonymously. The `WITH CHECK (true)` is the intentional design.

## Recommended next steps for whoever picks this up

1. **Sync the local migration folder.** Run `supabase db pull` (or `npx supabase migration list` then manual fetch) to bring `supabase/migrations/` in sync with prod. The current state makes every code-only audit unreliable. Track as its own task — it's a non-trivial review.
2. **Decide the SECURITY DEFINER posture.** One batched migration to REVOKE FROM PUBLIC + targeted GRANTs would close ~20 LOW-to-MEDIUM advisor findings in one shot.
3. **Open the multi-tenant Layer-3 design discussion** before any tenant-isolation migration. The 3-tenant rollout is currently shielded only by the operator's hands.
