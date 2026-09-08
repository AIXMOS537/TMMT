-- 20260908000100_rate_limit_hit_STAGED.sql
-- STAGED - NOT APPLIED. Production DDL is owner-gated (OWNER_DECISIONS D-18).
-- Backs src/lib/rate-limit-durable.ts (remediation F-11).
--
-- WHY
--   The app's rate limiter is a per-process Map. On Vercel each instance and
--   each cold start has its own, so a burst across instances is never limited
--   and every deploy resets the counts. Public endpoints (lead webhook, form
--   submit, sign-in, sign-up, Pocket chat) need a shared counter.
--
-- WHAT
--   One small table and one SECURITY DEFINER function that does an atomic
--   upsert per (key) and returns true when the caller is over the limit for
--   the current window. Only service_role may call it; the app calls it with
--   the service client. Until applied the app silently uses the Map.
--
-- SAFETY
--   Additive: new table, new function. No existing object changes. RLS on with
--   no policies, so no PostgREST role can read or write the table directly.
--
-- ROLLBACK
--   drop function if exists public.rate_limit_hit(text, integer, integer);
--   drop table if exists public.rate_limit_buckets;
--
-- TEST (after apply; expect f, f, t for a cap of 2 in a fresh window)
--   select public.rate_limit_hit('test:'||now()::text, 60000, 2);  -- run three times
--   delete from public.rate_limit_buckets where key like 'test:%';
--
-- HOUSEKEEPING
--   Rows are tiny and self-resetting; an optional nightly
--   `delete from public.rate_limit_buckets where window_start < now() - interval '1 day'`
--   keeps the table small. Not scheduled here.

create table if not exists public.rate_limit_buckets (
  key          text primary key,
  window_start timestamptz not null,
  hits         integer not null default 0
);
alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from public, anon, authenticated;

create or replace function public.rate_limit_hit(p_key text, p_window_ms integer, p_max_hits integer)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_now    timestamptz := now();
  v_window interval    := make_interval(secs => greatest(p_window_ms, 1000) / 1000.0);
  v_hits   integer;
begin
  insert into public.rate_limit_buckets as b (key, window_start, hits)
  values (p_key, v_now, 1)
  on conflict (key) do update
    set window_start = case when b.window_start < v_now - v_window then v_now else b.window_start end,
        hits         = case when b.window_start < v_now - v_window then 1 else b.hits + 1 end
  returning hits into v_hits;

  return v_hits > greatest(p_max_hits, 1);
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

comment on function public.rate_limit_hit(text, integer, integer) is
  'Atomic per-key hit counter with a sliding reset window. Returns true when the caller is over p_max_hits for the current window. service_role only; the app falls back to an in-memory limiter when this is absent.';

notify pgrst, 'reload schema';
