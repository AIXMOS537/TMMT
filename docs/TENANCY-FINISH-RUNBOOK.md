# Finish App-Layer Tenancy + Hardening — Local Runbook

Everything needed to complete the 4 handoff items **yourself**, locally. The critical
security lockdown is already live; this finishes the rest. All SQL is idempotent and
reversible — re-running is a no-op, nothing is dropped.

| # | Item | Artifact | Needs |
|---|---|---|---|
| 1 | Operators can transact (org_id on writes) | `supabase/migrations/20260618210000_operator_writes_org_default.sql` | access token |
| 2 | Lock last 2 anon install RPCs | `supabase/migrations/20260618211000_lock_install_rpc_anon.sql` | access token |
| 3 | Policies on 2 bare tables | `supabase/migrations/20260618212000_advisor_hardening_policies.sql` | access token |
| 4 | Onboard founders → `org_roles` | `scripts/onboard-founding-operators.mjs` | service_role key + email |

Project: **`uapxakmlwnpfsftfeezx`** (TMMT live).

---

## Step 0 — get your two keys (2 min, one time)

1. **Access token** (for applying SQL): https://supabase.com/dashboard/account/tokens →
   *Generate new token* → copy the `sbp_...` value.
2. **service_role key** (only for item 4): Supabase → your project → *Project Settings →
   API → `service_role` (secret)* → copy the `eyJ...` value.

Paste both into `.env.local` at the repo root (already git-ignored — never commit it):

```bash
SUPABASE_ACCESS_TOKEN=sbp_<paste-your-token-here>
SUPABASE_SERVICE_ROLE_KEY=<paste-your-service-role-key>   # the real one, not the placeholder
```

---

## Path A — one command (recommended)

```bash
cd ~/Projects/tmmt

# preview the exact SQL (no creds needed):
npm run db:finish-tenancy -- --dry-run

# apply items 1–3 + verify, AND onboard Umar in one shot:
npm run db:finish-tenancy -- --op "person@example.com=Org Name"
```

You'll see each migration `applying ... OK`, then a `✓` verification line per change,
then the onboarding result + Umar's one-time password (send it to him out-of-band; he
resets on first login). Add Aayan later by appending another flag:

```bash
npm run db:finish-tenancy -- --op "AAYAN_EMAIL=Khan Strategies LLC"
```

> The org name is matched against `organizations.name` (case-insensitive) — no UUIDs to copy.

---

## Path B — through Claude Code

Open Claude Code in this repo and paste:

```
Read docs/TENANCY-FINISH-RUNBOOK.md. I've put SUPABASE_ACCESS_TOKEN and
SUPABASE_SERVICE_ROLE_KEY in .env.local. Run `npm run db:finish-tenancy -- --dry-run`
first and show me the SQL. If it looks right, run
`npm run db:finish-tenancy -- --op "person@example.com=Org Name"`, then report the
verification results and Umar's one-time password. Do not commit anything.
```

---

## Path C — fully manual (Supabase SQL Editor, no keys in repo)

If you'd rather not put keys on disk: Supabase → **SQL Editor** → paste and run each
file's contents in order (1 → 2 → 3):

- `supabase/migrations/20260618210000_operator_writes_org_default.sql`
- `supabase/migrations/20260618211000_lock_install_rpc_anon.sql`
- `supabase/migrations/20260618212000_advisor_hardening_policies.sql`

Then onboard Umar (still needs the service key locally, OR do it by hand):

```sql
-- Umar must have signed up first (so a profiles row exists), then:
select public.onboard_org_member('person@example.com',
  (select id from public.organizations where name ilike 'Moe Legacy'), 'operator');
```

---

## Item 3 leftovers (intentionally not automated)

- **Leaked-password protection**: Supabase → *Authentication → Policies/Settings* →
  enable "Leaked password protection" (HaveIBeenPwned). Pure dashboard toggle.
- **Move `pg_net` / `vector` out of `public`**: low-severity WARN, deferred — moving the
  `vector` type can break unqualified column type refs. Do it deliberately with app
  testing, not as a drive-by.

---

## Verify anytime / rollback

Re-run advisors after applying:

```bash
# (or use the Supabase MCP get_advisors security)
npm run db:finish-tenancy -- --dry-run   # shows SQL; the real run prints ✓ checks
```

Rollback (only if needed — all reversible):

```sql
-- item 2: re-open install RPCs to anon (NOT recommended)
grant execute on function public.bind_install(uuid,text,text) to anon;
grant execute on function public.license_heartbeat(uuid,text) to anon;

-- item 1: revert a table's default back to home org (example)
alter table public.bookings alter column org_id
  set default '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid;

-- item 3: drop the added policies
drop policy if exists enforcement_settings_staff_all on public.enforcement_settings;
drop policy if exists operator_va_assignments_staff_all on public.operator_va_assignments;
```
