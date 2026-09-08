-- 20260908000000_agent_messages_provider_sid_index_STAGED.sql
-- STAGED — NOT APPLIED. Production DDL is owner-gated (OWNER_DECISIONS D-18).
-- Hardens the inbound-SMS replay gate shipped in src/app/api/agent/sms/inbound/route.ts.
--
-- WHY
--   Twilio webhook signatures carry no timestamp and no nonce, so a captured
--   valid request stays valid forever. The route records Twilio's MessageSid in
--   agent_messages.metadata->>'provider_message_sid' and looks it up before
--   processing (the soft gate). Two deliveries of the same sid that race past
--   that lookup would both proceed; this index makes the second INSERT fail
--   with 23505, which the route already handles as "drop the replay".
--
-- WHY AN EXPRESSION INDEX ON metadata
--   production agent_messages has no provider_message_sid column and the app is
--   already writing the sid into the existing metadata jsonb, so no column is
--   added and no row is rewritten. Partial: outbound rows have no sid and must
--   not collide with each other.
--
-- SAFETY
--   Additive. CONCURRENTLY so it does not lock the table (run outside a
--   transaction). If any duplicate sids already exist the build fails and
--   nothing changes; list them first with the query in TEST below.
--
-- ROLLBACK
--   drop index if exists public.agent_messages_provider_sid_uniq;
--
-- TEST (run before apply; expect zero rows)
--   select metadata->>'provider_message_sid' sid, count(*)
--     from public.agent_messages
--    where metadata->>'provider_message_sid' is not null
--    group by 1 having count(*) > 1;

create unique index concurrently if not exists agent_messages_provider_sid_uniq
  on public.agent_messages ((metadata->>'provider_message_sid'))
  where metadata->>'provider_message_sid' is not null;

comment on index public.agent_messages_provider_sid_uniq is
  'Twilio MessageSid replay gate for inbound SMS: the insert fails with 23505 on a duplicate, before any LLM call or reply.';
