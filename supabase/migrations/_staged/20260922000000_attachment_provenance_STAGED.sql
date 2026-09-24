-- CHANGE_REQUEST_001 — provenance columns + private buckets for attachment extraction
--
-- STAGED. Not applied. `supabase db push` ignores this directory.
-- Requires the owner's explicit, named authorization (Prime Directive 8) AND Gate 0's offline
-- archive to exist first — that archive is the rollback for everything downstream.
--
-- WHY
-- Phase 2 §4.3 requires every stored file to record: source table, source record id, source
-- field id, original filename, content type, byte size, sha256, extraction timestamp.
-- `documents` and `vehicle_media` can hold none of it, so the Gate 2 line "every row has a
-- non-null storage path and a sha256" is unsatisfiable by construction.
--
-- RISK: LOW. All three target tables hold 0 rows (VERIFIED 2026-09-16), so there is no
-- backfill and no existing reader depends on the NOT NULL being dropped.
--
-- ROLLBACK is clean ONLY while the tables are empty. Apply this BEFORE extraction, or not at
-- all. Rollback SQL is at the foot of this file.

begin;

-- ---------------------------------------------------------------------------------
-- 1. Provenance on public.documents
-- ---------------------------------------------------------------------------------
alter table public.documents
  add column if not exists source_system     text,
  add column if not exists source_table      text,
  add column if not exists source_record_id  text,
  add column if not exists source_field_id   text,
  add column if not exists original_filename text,
  add column if not exists content_type      text,
  add column if not exists byte_size         bigint,
  add column if not exists sha256            text,
  add column if not exists doc_type          text,
  add column if not exists extracted_at      timestamptz,
  -- documents.case_id is a `cases` FK and cannot express a Background Check / Ticket /
  -- Expense parent. These two columns carry the real one.
  add column if not exists parent_table      text,
  add column if not exists parent_id         uuid;

comment on column public.documents.sha256 is
  'Content hash of the stored object. Gate 2 requires this non-null on every extracted row.';
comment on column public.documents.parent_table is
  'Real owning table. case_id is a cases FK and cannot express a background_checks parent.';
comment on column public.documents.doc_type is
  'Retention-policy key. Must match a rule in config/retention-policy.json.';

-- ---------------------------------------------------------------------------------
-- 2. Provenance on public.vehicle_media
-- ---------------------------------------------------------------------------------
alter table public.vehicle_media
  add column if not exists source_system     text,
  add column if not exists source_table      text,
  add column if not exists source_record_id  text,
  add column if not exists source_field_id   text,
  add column if not exists original_filename text,
  add column if not exists content_type      text,
  add column if not exists byte_size         bigint,
  add column if not exists sha256            text,
  add column if not exists doc_type          text,
  add column if not exists extracted_at      timestamptz,
  add column if not exists parent_table      text,
  add column if not exists parent_id         uuid;

-- 41 Fleet vehicle photos and registrations have no customer. Requiring an email would force
-- fabricating one to satisfy a constraint — the failure the Prime Directives forbid.
-- Safe only while the table is empty (VERIFIED 0 rows).
alter table public.vehicle_media
  alter column customer_email drop not null;

comment on column public.vehicle_media.customer_email is
  'Nullable since CR-001: company-asset media (fleet photos, registrations) has no customer.';

-- ---------------------------------------------------------------------------------
-- 3. Idempotency — a re-run can never double-insert
-- ---------------------------------------------------------------------------------
create unique index if not exists documents_source_provenance_uniq
  on public.documents (source_table, source_record_id, source_field_id, sha256)
  where source_table is not null and sha256 is not null;

create unique index if not exists vehicle_media_source_provenance_uniq
  on public.vehicle_media (source_table, source_record_id, source_field_id, sha256)
  where source_table is not null and sha256 is not null;

-- Lookup path the extractor's --verify mode uses.
create index if not exists documents_parent_idx
  on public.documents (parent_table, parent_id);
create index if not exists vehicle_media_parent_idx
  on public.vehicle_media (parent_table, parent_id);

-- ---------------------------------------------------------------------------------
-- 4. Private storage buckets — one per entity
-- ---------------------------------------------------------------------------------
-- public = false on every one. There is no scenario in which a bucket holding driver's
-- licences is public.
insert into storage.buckets (id, name, public)
values
  ('background-checks', 'background-checks', false),
  ('tickets',           'tickets',           false),
  ('fleet',             'fleet',             false),
  ('inspections',       'inspections',       false),
  ('expenses',          'expenses',          false),
  ('insurance',         'insurance',         false),
  ('do-not-rent',       'do-not-rent',       false)
on conflict (id) do nothing;

commit;

-- ---------------------------------------------------------------------------------
-- POSTCONDITION VERIFICATION — run these AFTER applying.
-- CLAUDE.md: "success: true is NOT proof the state changed — the postcondition query is."
-- ---------------------------------------------------------------------------------

-- 4a. All 12 provenance columns present on both tables? Expect 24.
--   select count(*) from information_schema.columns
--   where table_schema='public' and table_name in ('documents','vehicle_media')
--     and column_name in ('source_system','source_table','source_record_id','source_field_id',
--                         'original_filename','content_type','byte_size','sha256','doc_type',
--                         'extracted_at','parent_table','parent_id');

-- 4b. customer_email actually nullable? Expect 'YES'.
--   select is_nullable from information_schema.columns
--   where table_schema='public' and table_name='vehicle_media' and column_name='customer_email';

-- 4c. All four indexes present? Expect 4.
--   select count(*) from pg_indexes where schemaname='public'
--     and indexname in ('documents_source_provenance_uniq','vehicle_media_source_provenance_uniq',
--                       'documents_parent_idx','vehicle_media_parent_idx');

-- 4d. All 7 buckets present AND private? Expect 7 rows, public=false on every one.
--   select id, public from storage.buckets
--   where id in ('background-checks','tickets','fleet','inspections','expenses','insurance','do-not-rent')
--   order by id;

-- 4e. NO bucket anywhere is public? Expect 0.
--   select count(*) from storage.buckets where public is true;

-- 4f. RLS still enabled on both tables, and policies still present? Expect rowsecurity=true
--     and policies > 0 on both. Behaviour, not the flag — re-read the policies too.
--   select c.relname, c.relrowsecurity,
--          (select count(*) from pg_policy p where p.polrelid=c.oid) as policies
--   from pg_class c join pg_namespace n on n.oid=c.relnamespace
--   where n.nspname='public' and c.relname in ('documents','vehicle_media');

-- 4g. Re-run the Supabase security + performance advisors.

-- ---------------------------------------------------------------------------------
-- ROLLBACK — clean ONLY while documents and vehicle_media hold 0 rows.
-- Once extraction has run, rolling back means deciding what happens to extracted files.
-- ---------------------------------------------------------------------------------
-- begin;
--   drop index if exists public.documents_source_provenance_uniq;
--   drop index if exists public.vehicle_media_source_provenance_uniq;
--   drop index if exists public.documents_parent_idx;
--   drop index if exists public.vehicle_media_parent_idx;
--   alter table public.documents
--     drop column if exists source_system, drop column if exists source_table,
--     drop column if exists source_record_id, drop column if exists source_field_id,
--     drop column if exists original_filename, drop column if exists content_type,
--     drop column if exists byte_size, drop column if exists sha256,
--     drop column if exists doc_type, drop column if exists extracted_at,
--     drop column if exists parent_table, drop column if exists parent_id;
--   alter table public.vehicle_media
--     drop column if exists source_system, drop column if exists source_table,
--     drop column if exists source_record_id, drop column if exists source_field_id,
--     drop column if exists original_filename, drop column if exists content_type,
--     drop column if exists byte_size, drop column if exists sha256,
--     drop column if exists doc_type, drop column if exists extracted_at,
--     drop column if exists parent_table, drop column if exists parent_id;
--   -- only safe while the table is empty:
--   alter table public.vehicle_media alter column customer_email set not null;
--   delete from storage.buckets
--    where id in ('background-checks','tickets','fleet','inspections','expenses','insurance','do-not-rent');
-- commit;
