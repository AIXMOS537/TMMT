# profiles: access columns are not self-editable

**Status:** fix prepared, **not applied**. Migration
`supabase/migrations/20260917160000_profiles_protect_access_columns.sql`.
Applying it is an owner-gated production change and needs the prod write baton.

## The invariant

A signed-in user must not be able to change any `public.profiles` value that
authorization reads. Today they can: the row is theirs, and nothing restricted
which of its columns they write.

## Why it matters

The database decides who someone is by reading their own profile row:

| Helper | Reads | Used by |
|---|---|---|
| `is_admin()`, `is_staff()`, `is_internal_ops()`, `is_platform_admin()`, `current_role()` | `role`, `portal_role` | 239 policies on 130 tables |
| `is_org_member()`, `backend_unlocked_for()` | `organization_id`, `role` | org-scoped policies, backend unlock |
| `current_profile_email()` and inline `profiles.email` lookups | `email` | 21 customer policies on 18 tables (cases, ledger, alerts, bookings, payments, vehicle media...) |

`authenticated` held full table-level write grants on `profiles`, and
`profiles_self_update` checks only that the row is the caller's. So a user could
change their own role (and become staff or admin everywhere), or their email
(and match a different customer's rows).

## The fix

Two independent layers. Each one blocks the attack by itself; the rehearsal
proves that with the other removed.

1. **Trigger** `profiles_block_protected_self_edits`, BEFORE INSERT OR UPDATE.
   For `anon`/`authenticated` callers: inserts are refused, and an update is
   refused if anything other than `full_name`, `phone` or `updated_at` changes.
   It is an allowlist over the whole row, so new columns are protected by default.
2. **Grants.** `anon` and `authenticated` lose INSERT, UPDATE, DELETE, TRUNCATE,
   REFERENCES and TRIGGER on `profiles`. `authenticated` keeps
   `UPDATE (full_name, phone, updated_at)`. SELECT and all policies are unchanged.

Not affected: `service_role`, `postgres`, the Supabase auth admin, the signup
triggers (`handle_new_auth_user`, `handle_new_user`), and foreign-key cascades.

## Compatibility

- No app code writes `profiles` with a user or anon key. Every call in `src/`,
  `scripts/` and `supabase/functions/` is a read (checked 2026-09-17).
- `scripts/set-admin-role.mjs` uses `service_role` + `auth.admin`, so it is unaffected.
- **Deliberate change:** an admin's own session can no longer change a role or
  email through the API. Do those through `service_role` or SQL. Nothing does it today.
- Production has 3 accounts. All have confirmed emails that match their profile.

## Evidence

`node scripts/tests/sql/profiles-access-columns.rehearsal.mjs` (PGlite 0.5.8,
PostgreSQL 17 like production). The fixture copies production's helper
functions, the policies on `profiles`/`cases`/`rental_ledger`/`client_alerts`,
and the default grants, read from the catalog. 21 checks:

- The attacks **succeed on the fixture without the migration.** That proves the
  test can see the hole.
- With the migration, each of the 16 protected columns is refused, under the
  full migration, grants only, and trigger only.
- Other routes fail too: a protected column smuggled into an allowed update,
  an upsert, an insert, a delete, and writes by anon.
- The customer stays non-staff in every helper and reads only their own cases,
  ledger and alerts.
- Legitimate writes still work: own name and phone, admin display edits,
  `service_role` role changes, signup, and FK cascades. Re-applying is a no-op.

Mutation-checked: allowlisting `role`, exempting `authenticated` in the trigger,
or leaving the `email` column grant each makes the suite fail.

## Not covered (follow-ups, separate decisions)

1. **Email is still the customer identity.** After this fix nobody can *change*
   a profile email. But customer rows match on email, so whoever first registers
   an address inherits rows already filed under it. That is safe only while
   Supabase Auth requires email confirmation, which is a dashboard setting and
   **was not verified**. Longer term, customer policies should key on
   `auth.uid()` (or on a confirmed `auth.users.email`). That is a policy and data
   migration across 18 tables, deliberately not part of this fix.
2. **SECURITY DEFINER functions owned by `postgres` bypass the trigger** by
   design. Today only the two signup triggers write `profiles`. A future such
   function taking caller input must authorize the caller itself.
3. `is_staff()` is still broad (see `SECURITY-LAYER-3-RLS-FINDINGS.md`). This fix
   stops people making themselves staff. It does not narrow what staff can reach.
4. Portal work that gives customers accounts stays blocked until this is
   applied and verified in production.

## Verifying after apply (read-only)

```sql
select has_table_privilege('authenticated','public.profiles','UPDATE')          as table_update,  -- false
       has_column_privilege('authenticated','public.profiles','role','UPDATE')  as role_update,   -- false
       has_column_privilege('authenticated','public.profiles','email','UPDATE') as email_update,  -- false
       has_column_privilege('authenticated','public.profiles','full_name','UPDATE') as name_update, -- true
       has_table_privilege('anon','public.profiles','UPDATE')                   as anon_update,   -- false
       (select count(*) from pg_trigger
         where tgrelid = 'public.profiles'::regclass
           and tgname = 'profiles_block_protected_self_edits')                  as guard;         -- 1
```
