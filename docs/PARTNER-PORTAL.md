# Partner / investor portal

Read-only fleet status for investor accounts. Data access is enforced in Postgres (RLS + `get_partner_fleet()`), not only in the UI.

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

Partners only receive columns returned by `get_partner_fleet()` (vehicle label, coarse status, color, percentage, portal notes timestamp). They do **not** see GPS/trackers when added elsewhere, contracts, insurance, payments, customers, plates, VIN, or dwell time calculations.

## Verification checklist (manual)

After the migration runs in Supabase:

1. Staff user (`role` empty, `admin`, or `va`): dashboard at `/` loads; saving a fleet row still works.
2. Partner user (`role` = `partner`, with `partner_fleet_access` rows): `/partner` shows only linked vehicles; `/` redirects to `/partner`; `/fleet` redirects to `/partner`.
3. As partner, in browser devtools or REST: `GET /rest/v1/fleet` returns no rows (RLS). `POST` to `rpc/get_partner_fleet` returns the safe projection only.
4. As partner, confirming `incoming_leads` / `customer_payments` / `contracts` return no readable rows via the anon REST client carrying the JWT.
