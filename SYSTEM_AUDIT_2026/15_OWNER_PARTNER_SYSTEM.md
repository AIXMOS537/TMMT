# 15 · VEHICLE OWNER / PARTNER ECOSYSTEM

## Verdict: 🔵 **Designed, secured, and never used.** `partner_fleet_access` = **0 rows**. Owner statement: *"No vehicles and no partners currently."*

## What exists
| Capability | Built | Live data |
|---|---|---|
| Owner onboarding | 🔵 no dedicated flow | — |
| Identity / verification | 🔵 | — |
| Vehicle onboarding | 🟡 `/forms/onboarding-inspection` | `vehicle_onboarding_inspections` **0** |
| Agreements | 🔵 | `lto_agreements` 0, `contract_instances` 0 |
| Vehicle→owner mapping | 🟡 `partner_fleet_access` + `get_partner_fleet()` RPC | **0** |
| Rental assignment | 🔵 | `partner_vehicle_rentals()` RPC exists |
| Revenue share | 🟡 `revenue_splits`, `partner_split_segment_rules`, `backfill_client_partner_splits` | `revenue_splits` **0** |
| Payouts / statements | 🔵 | none |
| Owner portal | 🟡 `/(partner)/partner` | renders "No vehicles assigned yet" — permanently |
| Owner reporting | 🔵 | — |

## Assessment
The **security** model for partners is genuinely complete: `partner_portal_rls`, `vendor_portal_rls_policies`, `scope_external_roles_and_partner_rental_window`, `rls_operator_revenue_splits_self_read`, and a `get_partner_fleet()` definer RPC. Someone thought carefully about not leaking one partner's data to another.

What is missing is everything **before** that: no onboarding, no verification, no agreement generation, no payout calculation, no statement. The partner portal is a **read-only window onto an empty table**, protected by excellent locks on a door to an empty room.

**Recommendation:** freeze. Revenue-share and payout logic is meaningful work that should be built when the first partner signs — not before. The RLS foundation will still be there.
