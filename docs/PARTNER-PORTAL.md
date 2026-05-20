# Partner / investor portal

Read-only fleet status for investor accounts. Data access is enforced in Postgres (RLS + `get_partner_fleet()`), not only in the UI.

## Additive — does not replace admin

This portal is a **separate route and layout** on top of the existing staff app:

| Audience | Route | Layout |
|----------|--------|--------|
| **Staff** (`admin`, `va`, or empty `role`) | `/` and all existing admin pages (`/fleet`, `/leads`, …) | `(admin)/` + Sidebar — **unchanged** |
| **Partners** (`role` = `partner`) | `/partner` only (middleware blocks other admin URLs) | `(partner)/` — no Sidebar |

Same `/login` for everyone; middleware sends partners to `/partner` and staff to `/`. Nothing in this feature removes or replaces the admin dashboard or its 17+ pages.

## Apply the database migration

Run [`supabase/migrations/20260503120000_partner_portal_rls.sql`](../supabase/migrations/20260503120000_partner_portal_rls.sql) in the Supabase SQL editor (or your migration pipeline) **before** onboarding partners.

Until this migration runs, legacy behavior remains: every authenticated user can still read/write all operational tables.

## Staff roles (`app_metadata.role`)

Use Supabase Dashboard → Authentication → Users → select user → **User Metadata** → `app_metadata` JSON:

| `role` value | Access |
|----------------|--------|
| `admin` | Full staff dashboard + writes |
| `va` | Same as admin (differentiate in UI later if needed) |
| *(missing or empty)* | Treated as **staff** (`admin`-equivalent access) — legacy fallback |
| `partner` | Only `/partner`; cannot read sensitive tables |

### One-time backfill for existing staff

After deploying the migration, optionally pin explicit roles:

```sql
-- Example: inspect current users (run in SQL editor).
-- select id, email, raw_app_meta_data from auth.users;
```

Preferred: Supabase Dashboard or Admin API (`auth.admin.updateUserById`) to set `raw_app_meta_data` / app metadata `{ "role": "admin" }` for internal accounts.

Partners must receive `{ "role": "partner" }`.

## Assign vehicles to a partner

Insert rows linking the partner’s **`auth.users.id`** to **`fleet.id`**:

```sql
INSERT INTO partner_fleet_access (partner_user_id, fleet_id)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
```

Staff CRUD goes through the admin Fleet UI (`partner_portal_notes` field) plus future tooling; `partner_fleet_access` rows can also be inserted from Retool/API.

## Invite flow (Supabase Auth)

1. Invite the partner email in Supabase Authentication.
2. Set `app_metadata.role` to **`partner`** before or after first login (JWT refreshes carry the claim).
3. Insert `partner_fleet_access` for each vehicle they should see.

### Dev: scripted test user (local)

After the partner migration is applied in your Supabase project:

```bash
npm run create-partner-test-user
# or:
npm run create-partner-test-user -- --email you@example.com --password 'YourPassword123!'
# optional: --fleet-id <uuid>  (defaults to first vehicle in `fleet`)
```

Uses `SUPABASE_SERVICE_ROLE_KEY` from `.env`. Prints credentials once — delete or change the user in the Supabase dashboard when done testing.

## Partner-safe fields

Partners only receive columns returned by `get_partner_fleet()` (vehicle label, coarse status, color, percentage, portal notes timestamp, **license plate**, **VIN**, and last-updated). They do **not** see GPS/trackers when added elsewhere, contracts, insurance, payments, customer names, or dwell time calculations beyond this projection.

## Verification checklist (manual)

After the migration runs in Supabase:

1. Staff user (`role` empty, `admin`, or `va`): dashboard at `/` loads; saving a fleet row still works.
2. Partner user (`role` = `partner`, with `partner_fleet_access` rows): `/partner` shows only linked vehicles; `/` redirects to `/partner`; `/fleet` redirects to `/partner`.
3. As partner, in browser devtools or REST: `GET /rest/v1/fleet` returns no rows (RLS). `POST` to `rpc/get_partner_fleet` returns the safe projection only.
4. As partner, confirming `incoming_leads` / `customer_payments` / `contracts` return no readable rows via the anon REST client carrying the JWT.

---

## Product intent: what partners should understand about “their” cars

Partners who work with TMMT are investors or aligned operators: they need **confidence that the asset is real, cared for, and current** — without getting the full admin stack (customers, contracts, payments, plates, VIN, etc.).

### Today (`/partner`)

- Coarse **vehicle status** (e.g. Available / Rented / Under Maintenance).
- **Identity-ish presentation**: name / make / model / year / color, **partner share %**, **portal notes**, **last updated** timestamp.
- **No** inspection galleries, **no** maintenance photo timelines, **no** odometer/mileage line items in the partner RPC yet.

### Agreed direction (roadmap — not all built yet)

When we extend the portal, partners should be able to see **what is going on with the car so far**, in a read-only, partner-safe way:

1. **Updated inspection pictures of the car**  
   - Recent **vehicle / program inspection** imagery (condition checks), tied only to vehicles they are linked to via `partner_fleet_access`.  
   - Goal: “Here is how the car looks now” — not customer PII, not full inspection forms unless fields are explicitly sanitized.

2. **Updated maintenance pictures with mileage**  
   - **Maintenance-related** photos (shop, work in progress, completed work) where staff attach them.  
   - **Mileage / odometer** surfaced next to those updates when available (e.g. from inspection records or maintenance entries), so partners see **when** and **at what miles** work happened.

### Engineering guardrails (when implementing)

- **Still no direct table access** for partners to `fleet`, `maintenance_appointments`, `customer_inspection_photos`, `fleet_car_inspections`, etc. — today those are **staff-only** under partner RLS. Any new data must go through **new partner-safe RPCs** (or narrow `SELECT` policies scoped by `partner_fleet_access`) that strip PII and only return allowed columns.
- **Photos**: likely **Supabase Storage** paths with **short-lived signed URLs** (same pattern as staff document uploads), or a single RPC that returns signed URLs for objects under a partner-scoped prefix — never expose service role to the browser.
- **Ordering**: show **most recent first** (inspection set, maintenance set) with clear **dates** and **mileage** on maintenance-related items.

### Related tables (staff-facing today; partner projection TBD)

- `customer_inspection_photos`, `fleet_car_inspections` — inspection / condition context.  
- `maintenance_appointments` (and any future photo fields on maintenance) — upkeep timeline + mileage when modeled.  
Exact columns and RPC shape should be decided in a small design pass before migration + UI work.

This section records **business intent** from product discussion; implementation tasks can be tracked on the roadmap or as a follow-up migration + `/partner` UI iteration.
