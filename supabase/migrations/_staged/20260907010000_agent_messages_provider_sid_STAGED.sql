-- 20260907010000_agent_messages_provider_sid_STAGED.sql
-- STAGED — NOT APPLIED. Supports the inbound-SMS replay fix.
--
-- WHY
--   Twilio webhook signatures carry no timestamp and no nonce, so a captured
--   valid request stays valid forever. Replaying one re-runs the whole inbound
--   path: another LLM call, another lead-state transition, another human
--   handoff, and another SMS actually delivered to the customer. Signature
--   verification cannot prevent this — the replayed request IS correctly signed.
--
--   Idempotency has to come from the message identity. Twilio already supplies
--   one: MessageSid, unique per message and stable across its retries.
--
-- WHY A PARTIAL INDEX
--   Only inbound rows carry a provider sid. Outbound TwiML replies are handed to
--   Twilio in the HTTP response and we never see a sid for them, so those rows
--   keep NULL and must not collide with each other.

alter table public.agent_messages
  add column if not exists provider_message_sid text;

create unique index if not exists agent_messages_provider_sid_uniq
  on public.agent_messages (provider_message_sid)
  where provider_message_sid is not null;

comment on column public.agent_messages.provider_message_sid is
  'Twilio MessageSid for inbound messages. Unique where present: the insert IS the replay gate, so a duplicate webhook fails with 23505 before any LLM call or outbound send. NULL for outbound rows, which have no sid we observe.';
