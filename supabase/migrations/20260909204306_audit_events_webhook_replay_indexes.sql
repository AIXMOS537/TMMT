-- APPLIED to production 2026-09-09 20:43 UTC (schema_migrations 20260909204306).
--
-- DEVIATION FROM THE STAGED BODY, on purpose: `concurrently` was dropped from both
-- CREATE INDEX statements. It cannot run inside a transaction and the migration
-- runner uses one. Safe here because the table is 3891 rows and BOTH predicates
-- match ZERO rows today (cal.booking_created = 0, stripe.payment_collected = 0),
-- with no duplicate (organization_id, key) groups - checked before applying - so the
-- build is instant and the brief lock is immaterial. On a large table, restore
-- `concurrently` and run it outside a transaction.
--
-- 20260908000200_audit_events_webhook_replay_indexes_STAGED.sql
-- STAGED — NOT APPLIED. Production DDL is owner-gated (OWNER_DECISIONS D-18).
-- Hardens the webhook replay gates shipped in
--   src/app/api/agent/cal/webhook/[slug]/route.ts     (booking uid)
--   src/app/api/agent/stripe/webhook/[slug]/route.ts  (event id)
-- via src/lib/agent/webhook-replay.ts (remediation T-02b; partial F-18).
--
-- WHY
--   Cal.com's HMAC signature carries no timestamp and no nonce, so a captured
--   valid request stays valid forever. Stripe retries re-deliver the same
--   event.id inside its 5-minute signature tolerance. Each route already
--   writes exactly one audit_events row per processed event and, since T-02b,
--   that row carries the provider's stable id in payload:
--     cal.booking_created      -> payload->>'booking_uid'
--     stripe.payment_collected -> payload->>'event_id'
--   The route looks that id up before doing anything (the soft gate). Two
--   deliveries that race past the lookup would both proceed; these indexes
--   make the second audit INSERT fail with 23505, which src/lib/agent/audit.ts
--   already logs as a caught replay. The lead update is idempotent by effect
--   (same status), so the audit trail is the only thing the race can
--   duplicate — and this closes it.
--
-- WHY EXPRESSION INDEXES ON payload
--   audit_events is an append-only jsonb log with no per-provider columns, and
--   the app is already writing the ids into payload, so no column is added and
--   no row is rewritten. Partial on action so unrelated audit rows never
--   collide, and on the key being present so rows from before T-02b (Stripe
--   rows had no event_id; Cal rows may lack a uid) are excluded. Scoped by
--   organization_id: the same provider id for two tenants is two events.
--
-- SAFETY
--   Additive. CONCURRENTLY so it does not lock the table (run each statement
--   outside a transaction). If any duplicate keys already exist the build
--   fails and nothing changes; list them first with the queries in TEST below.
--   Requires the columns the app already reads/writes: organization_id,
--   action, payload (jsonb). The repo has no CREATE TABLE for audit_events
--   (docs/SCHEMA-DRIFT.md), so the first TEST query confirms them.
--
-- ROLLBACK
--   drop index if exists public.audit_events_cal_booking_uid_uniq;
--   drop index if exists public.audit_events_stripe_event_id_uniq;
--
-- TEST (run before apply)
--   -- expect 3 rows: organization_id, action, payload (payload = jsonb)
--   select column_name, data_type from information_schema.columns
--    where table_schema = 'public' and table_name = 'audit_events'
--      and column_name in ('organization_id', 'action', 'payload');
--   -- expect zero rows from each of these
--   select organization_id, payload->>'booking_uid' k, count(*)
--     from public.audit_events
--    where action = 'cal.booking_created' and payload->>'booking_uid' is not null
--    group by 1, 2 having count(*) > 1;
--   select organization_id, payload->>'event_id' k, count(*)
--     from public.audit_events
--    where action = 'stripe.payment_collected' and payload->>'event_id' is not null
--    group by 1, 2 having count(*) > 1;
--
-- SCOPE
--   One index per (action, key). A future handler for another Cal trigger
--   (e.g. cal.booking_rescheduled) needs its own partial index; do not widen
--   these.

create unique index concurrently if not exists audit_events_cal_booking_uid_uniq
  on public.audit_events (organization_id, (payload->>'booking_uid'))
  where action = 'cal.booking_created' and payload->>'booking_uid' is not null;

comment on index public.audit_events_cal_booking_uid_uniq is
  'Cal.com booking uid replay gate: a second cal.booking_created audit row for the same org+uid fails with 23505.';

create unique index concurrently if not exists audit_events_stripe_event_id_uniq
  on public.audit_events (organization_id, (payload->>'event_id'))
  where action = 'stripe.payment_collected' and payload->>'event_id' is not null;

comment on index public.audit_events_stripe_event_id_uniq is
  'Stripe event.id replay gate: a second stripe.payment_collected audit row for the same org+event fails with 23505.';
