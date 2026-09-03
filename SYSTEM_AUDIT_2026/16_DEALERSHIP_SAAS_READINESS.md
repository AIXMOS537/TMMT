# 16 · DEALERSHIP / WHITE-LABEL READINESS

## Classification: **PARTIALLY MULTI-TENANT** — further along than the business needs, and currently doing harm.

## What is genuinely built
| Layer | Status |
|---|---|
| Organizations | 🟢 `organizations` 9, `org_roles`, `is_org_member()`, `acting_org_id()` |
| Tenant isolation (DB) | 🟢 RLS org-scoping across core tables; `harden_tenant_isolation_phase1`, `tenant_scope_core_tables`, `fix_org_isolation`, `multitenant_hardening` |
| Domain routing | 🟢 `organization_domains` (2), `org_id_for_host()`, host-based middleware |
| Branding | 🟢 `tenant-map.generated.ts`, `BrandProvider`/`BrandLogo`/`BrandName` + brand-token tests |
| Licensing | 🟢 `organization_licenses` 4, `installations` 2, kill-switch, heartbeat/provision/revoke API |
| Billing / entitlements | 🟢 `packages` 10, `entitlements` 53, `package_entitlements` 94 |
| Per-tenant agents | 🟡 `agent_persona_overlay`, `tenant-overlay.test.ts` |
| Per-tenant integrations | 🟡 `org_ghl_connections`, `stripe_connect_account_id` |
| Dealer funnel | 🟢 `/dealers`, `/forms/dealer-apply`, `dealer_core` + `dealer_fleet_retail` migrations |
| Dealer applications received | 🔴 **`dealer_applications` = 0 rows** |

## The problem
There are **9 organizations and effectively one real business.** Of the 3 tenants in the generated map, one (`moe_legacy`) is a **terminated partnership** that should not exist at all.

And the cost is not theoretical:

> **The multi-tenancy feature is what broke lead intake.** `OrgRowShapeError` on `slug:aixmos` (184 failures) comes from the host-tenancy work of 2026-08-27. A feature built for customers who do not exist is destroying leads from the customer who does.

## Can this become a multi-tenant dealership platform?
**Yes — technically it is ~70% there,** and the hard part (DB-level isolation) is the part that is done. But three things must change first:

1. **Fix tenant identity.** Org ids must be real UUIDs, consistently, in one place. Today they are slugs in a generated map and UUIDs in the schema. This is P0-1.
2. **Remove `moe_legacy`** from the tenant map and brand assets (owner decision — governance, not engineering).
3. **Get one paying dealer.** `dealer_applications` has zero rows. There is no evidence of demand.

## Recommendation: **STOP.**
Not because the work is bad — it is competent — but because it is **unpaid complexity that is actively causing revenue loss.** Freeze the multi-tenant surface at its current state. Revisit when a dealer has paid a deposit. Everything built so far will still be there.
