# CHANGE_REQUEST_003 — Provenance columns + private storage buckets for attachment extraction

Status: **PROPOSED — awaiting owner approval.** Not applied.
Raised: 2026-09-15 · Blocks: Phase 2 (attachment extraction) · Prime Directive 8

---

## CURRENT

Phase 2 §4.3 requires that every stored file record: *source table, source record id, source
field id, original filename, content type, byte size, sha256, and extraction timestamp.*

The destination tables cannot hold any of that. VERIFIED from
`information_schema.columns` on 2026-09-15:

**`public.documents`** — `id`, `case_id`, `kind`, `title`, `storage_path`, `visibility`,
`uploaded_by`, `created_at`, `org_id`. 0 rows.

**`public.vehicle_media`** — `id`, `case_id`, `booking_id`, `vehicle_id`, `customer_email`,
`storage_path`, `file_name`, `caption`, `media_type`, `visible_to_client`, `uploaded_by`,
`metadata` (jsonb), `created_at`, `org_id`. 0 rows.

Three specific blockers:

1. **No provenance columns at all** — no `sha256`, no `byte_size`, no `content_type`, no
   `source_*`. Without `sha256` the Gate 2 line *"every row has a non-null storage path and a
   sha256"* is unsatisfiable by construction.
2. **`documents.case_id` is the only parent link, and it is a `cases` FK.** Background Checks,
   Tickets and Expenses rows are not cases. There is nowhere to record the real parent.
3. **`vehicle_media.customer_email` is `NOT NULL`.** Fleet vehicle photos and registrations have
   no customer. 41 Fleet records cannot be inserted without inventing an email — which is
   exactly the "adding a column purely because app code expects it / fabricating data to satisfy
   a constraint" failure the Prime Directives forbid.

Storage: three private buckets exist (`program-documents`, `staff-documents`, `vehicle-media`).
**None of the buckets §4.4 names exist.** All existing buckets are correctly `public = false`.

## PROPOSED

**1. Add provenance columns** to `documents` and `vehicle_media`:

| Column | Type | Note |
|---|---|---|
| `source_system` | `text` | `'airtable'` |
| `source_table` | `text` | e.g. `tbl1OFZh3cMXytNZM` |
| `source_record_id` | `text` | e.g. `recXXXXXXXXXXXXXX` |
| `source_field_id` | `text` | e.g. `fldDoihm4BZQpUPPt` |
| `original_filename` | `text` | |
| `content_type` | `text` | |
| `byte_size` | `bigint` | |
| `sha256` | `text` | |
| `doc_type` | `text` | retention-policy key |
| `extracted_at` | `timestamptz` | |
| `parent_table` | `text` | real parent, since `case_id` cannot express it |
| `parent_id` | `uuid` | |

Unique index on `(source_table, source_record_id, source_field_id, sha256)` so a re-run is
idempotent and can never double-insert.

**2. Relax `vehicle_media.customer_email` to nullable.** Company-asset media has no customer.
This is fixing the contract, not bending the data to fit it.

**3. Create six private buckets:** `background-checks`, `tickets`, `fleet`, `inspections`,
`expenses`, `insurance`, `do-not-rent`.
Policies: `service_role` write, tenant-scoped read via `org_id`, **no public access**.

**4. RLS policies** on the new columns' tables must be re-verified after the change — behaviour,
not the flag (§7.3).

## WHY

Without this, Phase 2 can upload bytes to storage but cannot record what they are or what they
belong to. An extraction with no provenance is not a migration — it is an undifferentiated pile
of files, and the Gate 2 line *"spot-check that each file is linked to the correct parent
record"* cannot be evaluated at all. *"A perfectly extracted archive attached to the wrong
renters is worse than no archive."*

## DEPENDENCIES

- **Gate 0 must pass first** (offline archive exists) — this is the rollback for everything.
- **Counsel's retention rule** determines `doc_type` handling; the column is needed either way.
- Owner authorization for a production DDL write (Prime Directive 8).

## RISK

**Low–moderate.** All three target tables hold **0 rows**, so there is no backfill and no
migration of existing data. Additive columns on empty tables cannot break a read path.

The two non-additive elements:
- Dropping `NOT NULL` on `vehicle_media.customer_email` **widens** what is accepted; existing
  readers that assume non-null would need checking. With 0 rows, no current data relies on it.
- New buckets are new namespaces; nothing existing references them.

Per `CLAUDE.md`: `success: true` is not proof the state changed — the postcondition query is.
Re-query `information_schema.columns` and `storage.buckets` after applying, and re-run the
Supabase advisors.

## ROLLBACK

```sql
-- columns are additive on empty tables; dropping them restores the prior shape exactly
alter table public.documents     drop column if exists sha256, drop column if exists source_record_id /* ... */;
alter table public.vehicle_media alter column customer_email set not null;  -- only while 0 rows
```
Buckets: delete the six new buckets (empty until extraction runs).

**Rollback is only clean while the tables are empty.** Once extraction has run, rolling back
means deciding what happens to the extracted files. Apply this change *before* extraction, or
not at all.
