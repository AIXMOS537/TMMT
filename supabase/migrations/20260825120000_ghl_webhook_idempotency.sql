-- GHL webhook idempotency store — replaces the in-process Map in
-- src/lib/ghl/webhook-auth.ts (consumeGhlEventId), which only dedupes within
-- a single warm Vercel instance. On a cold start or when a second instance
-- handles the retry, the in-memory cache is empty/different and a genuinely
-- duplicate GHL webhook (retry, or a replay of an event that has no
-- timestamp and so isn't caught by the 5-minute replay window) gets
-- processed twice.
--
-- Found during a full-codebase review, 2026-08-25.
--
-- STATUS: reviewable file for owner approval — NOT auto-applied (same
-- posture as 20260621020000_tenant_scope_rls_policies.sql).
--
-- Security posture (matches the rest of this DB): RLS on, no non-service
-- write/read policies, so only the server (service_role key, which bypasses
-- RLS) ever touches this table. Nothing here is org-scoped -- event ids are
-- opaque and cross-tenant by nature (one webhook stream from GHL).
--
-- The app code (src/lib/ghl/webhook-auth.ts) is written to fall back to the
-- old in-memory-only behavior if this table doesn't exist yet, so deploying
-- the code before running this migration is not a regression -- it just
-- doesn't get the cross-instance fix until the migration is applied.

create table if not exists public.ghl_webhook_events (
  event_id    text primary key,
  received_at timestamptz not null default now()
);

-- Prunes anything older than the window an attacker could plausibly still
-- replay (GHL_REPLAY_WINDOW_MS is 5 minutes for events that carry a
-- timestamp; events without one aren't time-gated at all, so keep a wider
-- margin). This keeps the table from growing unbounded without needing
-- pg_cron. Cheap: an index-only range scan + delete on a text/timestamptz PK
-- table, run opportunistically rather than on a schedule.
create index if not exists ghl_webhook_events_received_at_idx
  on public.ghl_webhook_events (received_at);

alter table public.ghl_webhook_events enable row level security;
-- No policies created: RLS on + zero policies = zero access for anon/
-- authenticated roles. service_role (server-side only) bypasses RLS
-- entirely, which is the only way this table should ever be touched.

-- Verification queries (run manually after apply):
--   select * from public.ghl_webhook_events order by received_at desc limit 20;
--   select count(*) from public.ghl_webhook_events;
