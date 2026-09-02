# SUPERSEDED migrations — kept for history, not for replay

The 32 `.sql` files here were the whole of `supabase/migrations/` until
2026-09-02. They are **superseded by**
`../20260902012451_remote_schema_baseline.sql`, which captures the live schema
in full.

This is **not** the same thing as [`../_parked/`](../_parked/README.md). Parked
migrations were *never applied* and are deliberately withheld because applying
them would split-brain the live system. These were *applied long ago* — they are
simply no longer the shortest path to a working database.

## Why they had to go

By 2026-09-01 the live database had **224 applied migrations** while this folder
held **32 files**, and only one version (`20260520150000`) appeared in both. The
other 192 changes were applied straight to production and never written back. A
clean checkout could not rebuild the database it talked to.

Replaying these 32 would not have produced the live schema, and would have
failed partway — they assume a 2026-05 database that no longer exists.

## What replaced them

`20260902012451_remote_schema_baseline.sql` — generated from `pg_catalog`
introspection (`pg_get_functiondef`, `pg_get_triggerdef`, `pg_get_indexdef`,
`pg_get_constraintdef`, `pg_get_viewdef`, `pg_policies`, `aclexplode`), the same
definitions `pg_dump` reads. Verified object-for-object against live:

| | count |
|---|---|
| tables | 161 |
| views | 21 |
| functions (project, non-extension) | 140 — 99 of them `SECURITY DEFINER` |
| triggers | 61 |
| RLS policies | 338 |
| indexes | 317 standalone + 232 constraint-backed |
| constraints | 572 |
| enum types | 41 |

It is recorded as already applied on the live project, so `supabase db push`
will not attempt to recreate it.

## Rules from here

1. **Do not replay anything in this folder.** It is history.
2. New migrations go in `supabase/migrations/` dated **after** the baseline.
3. Write the migration file *before* applying it live, so this never recurs.
4. Re-baseline only if drift opens up again — `scripts/backfill-schema.ps1`
   (dumps with your DB password) then `scripts/baseline-from-dump.ps1`.

## Scope caveat

The baseline covers the **`public`** schema. `auth`, `storage` and `realtime`
are Supabase-managed and intentionally excluded. Custom objects in those schemas
are not captured here.
