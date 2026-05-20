-- Client-visible updates: status history read + team messages without phone calls

create table if not exists public.case_status_history (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.cases(id) on delete cascade,
  from_status text,
  to_status   text not null,
  changed_by  uuid references public.profiles(id) on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists csh_case_idx on public.case_status_history(case_id, created_at desc);
alter table public.case_status_history enable row level security;

drop policy if exists csh_staff on public.case_status_history;
create policy csh_staff on public.case_status_history for select using (public.is_staff());

create or replace function public.log_case_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.case_status_history (case_id, from_status, to_status, changed_by)
    values (new.id, null, new.status::text, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.case_status_history (case_id, from_status, to_status, changed_by)
    values (new.id, old.status::text, new.status::text, auth.uid());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists cases_status_history on public.cases;
create trigger cases_status_history
  before insert or update of status on public.cases
  for each row execute function public.log_case_status_change();

-- Clients can read status history for their own cases (by email)
drop policy if exists csh_client_read on public.case_status_history;
create policy csh_client_read on public.case_status_history for select
  using (
    exists (
      select 1 from public.cases c
      where c.id = case_status_history.case_id
        and c.customer_email is not null
        and lower(c.customer_email) = lower(public.current_profile_email())
    )
  );

-- Team posts plain-language updates visible on client ticket / updates hub
create table if not exists public.case_client_updates (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid references public.cases(id) on delete cascade,
  customer_email  text not null,
  message         text not null,
  posted_by       uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists case_client_updates_email_idx
  on public.case_client_updates(lower(customer_email), created_at desc);

create index if not exists case_client_updates_case_idx
  on public.case_client_updates(case_id, created_at desc);

alter table public.case_client_updates enable row level security;

drop policy if exists case_client_updates_client_read on public.case_client_updates;
create policy case_client_updates_client_read on public.case_client_updates for select
  using (lower(customer_email) = lower(public.current_profile_email()));

drop policy if exists case_client_updates_staff on public.case_client_updates;
create policy case_client_updates_staff on public.case_client_updates for all
  using (public.is_staff()) with check (public.is_staff());

insert into public.entitlements (slug, name, category, portal) values
  ('updates_hub', 'Updates hub', 'support', 'client')
on conflict (slug) do nothing;

insert into public.package_entitlements (package_id, entitlement_slug)
select p.id, 'updates_hub'
from public.packages p
where p.slug in ('starter', 'growth', 'elite', 'custom')
on conflict do nothing;
