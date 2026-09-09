# Production migration workflow

> **`success: true` is not proof that the intended state changed. The postcondition query is.**

Derived from the 2026-09-03 audit-hardening migration, which reported success twice
and, the first time, changed almost nothing. Both failures were caught by steps 1
and 5 below. Follow this for every migration against `uapxakmlwnpfsftfeezx`.

## The ten steps

| # | Step | Why it exists |
|---|---|---|
| 1 | **Inspect the exact production object signature** | A migration written against a guessed signature aborts the whole transaction |
| 2 | **Generate the migration from the observed signature**, not from memory or from the repo | The repo does not describe production (see `docs/SCHEMA-DRIFT.md`) |
| 3 | **Check effective privileges, including inherited `PUBLIC` grants** | `REVOKE ... FROM anon` silently no-ops when the grant is to `PUBLIC` |
| 4 | **Apply** via `apply_migration` / `supabase db push` — never the dashboard | Dashboard changes are unreproducible; this is how 214-vs-41 drift happened |
| 5 | **Re-query the actual resulting state** | The postcondition, not the return value, is the evidence |
| 6 | **Re-run the security advisors** | Catches what you did not think to assert |
| 7 | **Synchronise repo migrations + docs** to the applied versions | Keeps the repo able to rebuild production |
| 8 | **`git status` / `git diff`** | Know exactly what changed on disk |
| 9 | **Human review** | — |
| 10 | **Commit only after approval** | Chain of Trust: stage never sign |

## The two failures this came from

### 1. `REVOKE ... FROM anon` was a no-op for 8 of 10 functions

The grant came from `PUBLIC`, which `anon` inherits. Postgres returned success and
changed nothing.

```sql
-- STEP 3: always look before revoking
select p.proname,
       coalesce(p.proacl::text, '(null = default: PUBLIC has EXECUTE)') as acl,
       has_function_privilege('anon',          p.oid, 'EXECUTE') as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authed,
       has_function_privilege('service_role',  p.oid, 'EXECUTE') as svc
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = ANY($1);
```

Read the `acl` column. A bare `=X/postgres` entry **is** the `PUBLIC` grant — revoke
that, not `anon`.

**Before revoking `PUBLIC`, confirm the roles you want to keep hold their own explicit
grants** (`authenticated=X/postgres`, `service_role=X/postgres`). If they only had
access via `PUBLIC`, revoking it locks them out too. On this run
`is_platform_admin()` had an explicit `authenticated` grant, which is the only reason
`lib/queries.ts:240` kept working.

### 2. Three function signatures were wrong

The draft wrote `claim_agent_job()`, `finish_agent_job()`, `fail_agent_job()`. All
three take arguments. `ALTER FUNCTION` on a signature that does not exist aborts the
entire migration and rolls back every preceding statement.

```sql
-- STEP 1: never write a signature from memory
select p.proname,
       pg_get_function_identity_arguments(p.oid) as identity_args,
       p.prosecdef  as security_definer,
       p.proconfig::text as cfg
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = ANY($1);
```

## Postcondition patterns worth reusing

```sql
-- did the revoke actually land?
select proname,
       has_function_privilege('anon', oid, 'EXECUTE') as anon_can_still_execute
from pg_proc where pronamespace = 'public'::regnamespace and proname = ANY($1)
order by anon_can_still_execute desc;   -- anything still true is a failure

-- did the policy actually get created?
select policyname, roles::text, cmd
from pg_policies where schemaname = 'public' and tablename = $1;

-- what version did production record?
select version, name from supabase_migrations.schema_migrations
order by version desc limit 5;
```

## A note on RLS

`ENABLE ROW LEVEL SECURITY` with **no policy** is not "locked down" — it is a
functional outage. Every read returns zero rows, which downstream code reads as "no
data" rather than "denied". This has bitten this codebase twice:

- `do_not_contact_numbers` — a missing SELECT policy made the DNC gate **fail open**
  (returned 0 rows ⇒ "nobody opted out") until 2026-07-16. Read that table's comment.
- `outreach_touches` — a missing SELECT policy meant the outreach engine could never
  record a touch, which is why the table sat at 0 rows until 2026-09-03.

After enabling RLS, always assert that the intended role can still read what it
should.

## Applied under this workflow

| Version | Name |
|---|---|
| `20260903185639` | `audit_hardening_20260903` |
| `20260903185722` | `audit_hardening_20260903_revoke_public` |

Result: security lints 60 → 46 · anon-callable SECURITY DEFINER 12 → 2 (both
intentional) · mutable `search_path` 3 → 0 · RLS-without-policy 4 → 3.
