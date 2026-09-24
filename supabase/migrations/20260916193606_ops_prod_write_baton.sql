-- Production write baton (owner-approved 2026-09-16, gap P0-PROC-01).
--
-- Reads stay parallel. Exactly ONE session may hold the baton, and must hold it
-- before any consequential production mutation: migrations, prod SQL/data writes,
-- prod config or integration changes, credential changes affecting prod, merges
-- to master (= deploy), live automation or communication activation.
--
-- Protocol (every session, through the Supabase SQL tool):
--   1. select ops.prod_baton_status();                       -- check
--   2. select ops.acquire_prod_baton(holder, workstream, purpose, operation, approval_ref);
--   3. first statement of the write: select ops.assert_prod_baton(holder);
--   4. verify the result
--   5. select ops.release_prod_baton(id, holder, result, evidence);
-- If someone else holds it: STOP and report the holder. Expiry does NOT release a
-- baton and acquire never steals one. A holder that is past expiry is recovered
-- only by ops.recover_stale_prod_baton(), which requires a written reason and is
-- recorded. See docs/ops/PROD-WRITE-BATON.md.
--
-- The baton is advisory coordination, not an availability dependency: nothing in
-- the application reads it, so a broken baton cannot take production down.
-- No PII is stored. anon/authenticated have no access to schema ops.

create schema if not exists ops;
revoke all on schema ops from public, anon, authenticated;
grant usage on schema ops to service_role;

create table if not exists ops.prod_write_baton (
  id                 bigint generated always as identity primary key,
  holder_session     text not null check (length(btrim(holder_session)) > 0),
  workstream         text not null check (length(btrim(workstream)) > 0),
  purpose            text not null check (length(btrim(purpose)) > 0),
  intended_operation text not null check (length(btrim(intended_operation)) > 0),
  owner_approval_ref text,
  acquired_at        timestamptz not null default now(),
  expires_at         timestamptz not null,
  released_at        timestamptz,
  result             text,
  evidence_ref       text,
  recovered_by       text,
  recovery_reason    text
);
-- The lock itself: at most one unreleased row, enforced by the database.
create unique index if not exists prod_write_baton_single_holder
  on ops.prod_write_baton ((true)) where released_at is null;

alter table ops.prod_write_baton enable row level security;
revoke all on ops.prod_write_baton from public, anon, authenticated;

create or replace function ops.prod_baton_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object(
       'state', case when b.expires_at < now() then 'held_expired' else 'held' end,
       'id', b.id, 'holder_session', b.holder_session, 'workstream', b.workstream,
       'purpose', b.purpose, 'intended_operation', b.intended_operation,
       'acquired_at', b.acquired_at, 'expires_at', b.expires_at)
       from ops.prod_write_baton b where b.released_at is null),
    jsonb_build_object('state', 'free'));
$$;

create or replace function ops.acquire_prod_baton(
  p_holder text, p_workstream text, p_purpose text, p_operation text,
  p_approval_ref text default null, p_ttl interval default interval '45 minutes')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if p_ttl <= interval '0' or p_ttl > interval '4 hours' then
    raise exception 'baton ttl must be between 0 and 4 hours';
  end if;
  begin
    insert into ops.prod_write_baton
      (holder_session, workstream, purpose, intended_operation, owner_approval_ref, expires_at)
    values (p_holder, p_workstream, p_purpose, p_operation, p_approval_ref, now() + p_ttl)
    returning id into v_id;
  exception when unique_violation then
    return jsonb_build_object('acquired', false) || ops.prod_baton_status();
  end;
  return jsonb_build_object('acquired', true) || ops.prod_baton_status();
end $$;

create or replace function ops.assert_prod_baton(p_holder text)
returns bigint language plpgsql stable security definer set search_path = '' as $$
declare v_id bigint;
begin
  select b.id into v_id from ops.prod_write_baton b
   where b.released_at is null and b.holder_session = p_holder and b.expires_at >= now();
  if v_id is null then
    raise exception 'production write baton not held by % (status: %)', p_holder, ops.prod_baton_status();
  end if;
  return v_id;
end $$;

create or replace function ops.renew_prod_baton(p_id bigint, p_holder text, p_ttl interval default interval '45 minutes')
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_ttl <= interval '0' or p_ttl > interval '4 hours' then
    raise exception 'baton ttl must be between 0 and 4 hours';
  end if;
  update ops.prod_write_baton set expires_at = now() + p_ttl
   where id = p_id and holder_session = p_holder and released_at is null;
  if not found then raise exception 'baton % is not held by %', p_id, p_holder; end if;
  return ops.prod_baton_status();
end $$;

create or replace function ops.release_prod_baton(p_id bigint, p_holder text, p_result text, p_evidence text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_result is null or length(btrim(p_result)) = 0 then
    raise exception 'release requires a result';
  end if;
  update ops.prod_write_baton set released_at = now(), result = p_result, evidence_ref = p_evidence
   where id = p_id and holder_session = p_holder and released_at is null;
  if not found then raise exception 'baton % is not held by %', p_id, p_holder; end if;
  return ops.prod_baton_status();
end $$;

-- Stale recovery: only after expiry, only with a named recoverer and a written
-- reason. It releases the stale row (it does NOT hand the baton to anyone); the
-- recoverer must still acquire normally afterwards.
create or replace function ops.recover_stale_prod_baton(p_id bigint, p_recovered_by text, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_recovered_by is null or length(btrim(p_recovered_by)) = 0
     or p_reason is null or length(btrim(p_reason)) < 20 then
    raise exception 'stale recovery requires recovered_by and a reason of at least 20 characters';
  end if;
  update ops.prod_write_baton
     set released_at = now(), result = 'stale_recovered',
         recovered_by = p_recovered_by, recovery_reason = p_reason
   where id = p_id and released_at is null and expires_at < now();
  if not found then
    raise exception 'baton % is not an expired, unreleased baton (status: %)', p_id, ops.prod_baton_status();
  end if;
  return ops.prod_baton_status();
end $$;

revoke all on function ops.prod_baton_status() from public, anon, authenticated;
revoke all on function ops.acquire_prod_baton(text, text, text, text, text, interval) from public, anon, authenticated;
revoke all on function ops.assert_prod_baton(text) from public, anon, authenticated;
revoke all on function ops.renew_prod_baton(bigint, text, interval) from public, anon, authenticated;
revoke all on function ops.release_prod_baton(bigint, text, text, text) from public, anon, authenticated;
revoke all on function ops.recover_stale_prod_baton(bigint, text, text) from public, anon, authenticated;
grant execute on function ops.prod_baton_status() to service_role;
grant execute on function ops.acquire_prod_baton(text, text, text, text, text, interval) to service_role;
grant execute on function ops.assert_prod_baton(text) to service_role;
grant execute on function ops.renew_prod_baton(bigint, text, interval) to service_role;
grant execute on function ops.release_prod_baton(bigint, text, text, text) to service_role;
grant execute on function ops.recover_stale_prod_baton(bigint, text, text) to service_role;
