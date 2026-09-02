-- Money Meter — server-side aggregation so the dashboard totals are ACCURATE.
--
-- Client-side aggregation over money_meter_events was silently capped by
-- PostgREST's max-rows (1000), which would under-report Used/Saved/free-forever
-- once the ledger grows. These functions SUM in SQL (no row cap) and run
-- SECURITY INVOKER, so the caller's RLS still applies: staff (is_staff bypass)
-- aggregate the whole platform; an org member only aggregates their own org.
-- Granted to authenticated so the owner dashboard can call them directly.

create or replace function public.money_meter_summary(p_since timestamptz default null)
returns jsonb
language sql
security invoker
set search_path = ''
stable
as $func$
  select jsonb_build_object(
    'collected',    coalesce(sum(amount_usd) filter (where direction = 'collected'), 0),
    'usedBillable', coalesce(sum(amount_usd) filter (where direction = 'used' and billable), 0),
    'usedAll',      coalesce(sum(amount_usd) filter (where direction = 'used'), 0),
    'saved',        coalesce(sum(amount_usd) filter (where direction = 'saved'), 0)
  )
  from public.money_meter_events
  where p_since is null or occurred_at >= p_since;
$func$;

create or replace function public.money_meter_summary_by_category(p_since timestamptz default null)
returns table (
  category      text,
  collected     numeric,
  used_billable numeric,
  used_all      numeric,
  saved         numeric
)
language sql
security invoker
set search_path = ''
stable
as $func$
  select
    category,
    coalesce(sum(amount_usd) filter (where direction = 'collected'), 0)              as collected,
    coalesce(sum(amount_usd) filter (where direction = 'used' and billable), 0)      as used_billable,
    coalesce(sum(amount_usd) filter (where direction = 'used'), 0)                   as used_all,
    coalesce(sum(amount_usd) filter (where direction = 'saved'), 0)                  as saved
  from public.money_meter_events
  where p_since is null or occurred_at >= p_since
  group by category
  order by (
    coalesce(sum(amount_usd) filter (where direction = 'collected'), 0)
    + coalesce(sum(amount_usd) filter (where direction = 'used'), 0)
    + coalesce(sum(amount_usd) filter (where direction = 'saved'), 0)
  ) desc;
$func$;

grant execute on function public.money_meter_summary(timestamptz)             to authenticated, service_role;
grant execute on function public.money_meter_summary_by_category(timestamptz) to authenticated, service_role;
