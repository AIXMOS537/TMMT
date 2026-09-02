# SUPERSEDED migrations — kept for history, not for replay

The 41 `.sql` files here were the entire contents of `supabase/migrations/`
until 2026-09-02. They are **superseded by**
`../20260902012451_remote_schema_baseline.sql`, which captures the live schema
in full.

This is **not** the same thing as [`../_parked/`](../_parked/README.md). Parked
migrations were *never applied* and are deliberately withheld, because applying
them would split-brain the live lead-routing system. These were *already
applied* — they are simply no longer the shortest path to a working database.

## Why they had to go

By 2026-09-01 the live database had **224 applied migrations** while this folder
held **32 files**, and only one version (`20260520150000`) appeared in both. The
other 192 changes went straight to production and were never written back. A
clean checkout could not rebuild the database it talked to.

Replaying these would not reproduce the live schema, and would fail partway —
they assume a 2026-05 database that no longer exists.

## Two groups are in here

**32 historical files** — the original `supabase/migrations/` contents, dating
from 2026-03 to 2026-08-25.

**9 pre-baseline files** (`20260828000000_sensitive_tables_admin_only` through
`20260901213358_packages_price_columns`), moved 2026-09-02. These were
themselves retroactive records of already-live schema. They had to move too: on
a *fresh* database the CLI would have run them **before** the baseline, against
tables that did not exist yet, and failed before ever reaching it.

Two of those nine (`sensitive_tables_admin_only`, `tasks_table`) never had a row
in `supabase_migrations.schema_migrations` at all — they documented schema that
had been applied by hand. Every object they define (`public.tasks`, the four
`*_admin_only` policies, `anon_insert_bg_checks`, `tasks_org_all`) was confirmed
present in the live catalog *and* in the baseline before the move, so nothing
was stranded.

## What replaced them

`20260902012451_remote_schema_baseline.sql` — generated from `pg_catalog`
introspection (`pg_get_functiondef`, `pg_get_triggerdef`, `pg_get_indexdef`,
`pg_get_constraintdef`, `pg_get_viewdef`, `pg_policies`, `aclexplode`), the same
definitions `pg_dump` reads. Verified object-for-object against live:

| object | count |
|---|---|
| tables | 161 |
| views | 21 |
| functions (project, non-extension) | 140 — 99 of them `SECURITY DEFINER` |
| triggers | 61 |
| RLS policies | 338 |
| indexes | 317 standalone + 232 constraint-backed = 549 |
| constraints | 572 |
| enum types | 41 |
| RLS enables | 161 |

The database reports 258 functions; 118 of those are extension-owned and come
back with `CREATE EXTENSION`, so 140 is the right count to carry here.

## Status on the remote

**The baseline IS recorded as applied.** Version `20260902012451` was inserted
into `supabase_migrations.schema_migrations` on 2026-09-02, so `supabase db push`
skips it and will not try to recreate the schema.

> The commit message on `3cf370f9` says the opposite — *"NOT yet recorded as
> applied on the remote."* That was true when written and is now stale. The
> branch had already been pushed, so it was corrected here rather than by
> force-pushing an amended message. **This file is the current record.**

That message also undercounts two figures: it says 31 superseded files (32 at
the time, 41 now) and 24 views (21).

## Rules from here

1. **Do not replay anything in this folder.** It is history.
2. New migrations go in `supabase/migrations/`, dated **after** the baseline.
3. Write the migration file *before* applying it live, so this cannot recur.
4. Re-baseline only if drift reopens: `scripts/backfill-schema.ps1` (dumps using
   your database password) then `scripts/baseline-from-dump.ps1`.

## Scope caveat

The baseline covers the **`public`** schema only. `auth`, `storage` and
`realtime` are Supabase-managed and intentionally excluded. Custom objects in
those schemas are not captured here.
