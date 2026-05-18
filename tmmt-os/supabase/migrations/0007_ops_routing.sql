-- Supplemental ops routing (core tables: RUN_OPS_ROUTING.sql)
-- Safe to run after RUN_OPS_ROUTING.sql or on a fresh DB with 0001+0002.

alter table public.crm_sync_records
  add column if not exists routing_result jsonb not null default '{}'::jsonb;

-- Optional typed enums when not using RUN_OPS_ROUTING text columns
do $$ begin
  create type public.case_type as enum ('rental', 'dispatch', 'investor', 'general');
exception when duplicate_object then null; end $$;

comment on table public.ops_locations is 'Per-market GHL pipeline + ClickUp list routing (see seed_ops_locations.sql)';
