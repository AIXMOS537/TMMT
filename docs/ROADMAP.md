# TMMT Rentals — Project Roadmap & Status

> Last updated: March 28, 2026

---

## Tier 1 — Data & Migration

| Item | Owner | Status |
|------|-------|--------|
| Lock in data model (fields, relationships, vehicle→rental→customer) | Together | ✅ Done — 44 tables, 25 main + 19 junction, schema complete |
| Get data model approval | Taha | ❓ Pending |
| Audit Airtable data — confirm no tables missed | Brandon | ❓ Needs sign-off — sync script covers 18 main + 19 junction tables |
| Define cut-over date/time from Airtable to new system | Z | ❓ Not set |

---

## Tier 2 — Core Business Logic

> Owner: Brandon

| Item | Status |
|------|--------|
| Insurance: claim table, status automations, team reminders | 🟡 Partial — insurance page + 24 records migrated; no automations or reminders yet |
| Inspections: new car, monthly check-in, standard — all tied to VIN | 🟡 Partial — inspections page + 2 public forms exist; VIN-linkage needs verification |
| Tickets: map current workflow, address physical mail dependency and failure points | 🟡 Partial — tickets page + public form exist, 257 records; no workflow automations |
| Lead funnel: auto-route non-qualifying leads into credit repair pipeline | ❌ Not done — leads page exists with status tracking but no auto-routing |
| Contracts: support multiple types (JV, customer, vehicle swap, insurance) | 🟡 Partial — contracts page exists, 1 record; multi-type support not built |
| Brandon's team: prioritize maintenance, insurance, and ticket items | ❓ Pending prioritization |
| Maintenance appointments: show/no-show toggle (mirroring Airtable's button/switch pattern) | 🔄 In progress — spec approved (`docs/superpowers/specs/2026-03-26-maintenance-toggle-design.md`), not yet built |

---

## Tier 3 — Features & Integrations

> Owner: Brandon

| Item | Status |
|------|--------|
| Lead form: Vercel-hosted, populates DB directly, no GHL dependency | ✅ Done — `/forms/lead-intake` live, inserts directly to Supabase |
| VIN/QR scanning for car data and inspection history | ❌ Not done |
| Autofill fields from existing DB entries (e.g. vehicle info on insurance forms) | ❌ Not done |
| Calendar integration (Google Meet, Zoom) | ❌ Not done |
| Open architecture for linking additional tools | ❌ Not done |

---

## Tier 4 — Ownership

| Item | Owner | Status |
|------|-------|--------|
| Business owner to finalize requirements and agenda items | Taha | ❓ Pending |

---

## Tier 5 — Branding

> Owner: Z

| Item | Status |
|------|--------|
| White-label as "TMMT Rentals" / "AMOS Fleet Software" | ❌ Not done |
| Gather branding assets and color palette from team | ❌ Not done |

---

## Summary

The platform is fully functional as a data management system — migration complete, all 17 admin pages and 8 public forms live, auth working. The gaps are all in business logic automation (Tier 2), integrations (Tier 3), and branding (Tier 5).

| Tier | Done | Partial | Not Done | Pending |
|------|------|---------|----------|---------|
| Tier 1 — Data & Migration | 1 | 0 | 0 | 3 |
| Tier 2 — Core Business Logic | 0 | 4 | 2 | 1 |
| Tier 3 — Features & Integrations | 1 | 0 | 4 | 0 |
| Tier 4 — Ownership | 0 | 0 | 0 | 1 |
| Tier 5 — Branding | 0 | 0 | 2 | 0 |
