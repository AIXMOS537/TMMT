-- Employee time clock: check in / check out. Each row is one shift.
-- Applied to production 2026-06-09. Employees read/write only their own entries;
-- staff/owner (is_staff()) can see everyone's for timesheets.
create table if not exists public.time_clock_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists time_clock_user_idx on public.time_clock_entries(user_id, clock_in desc);
create index if not exists time_clock_open_idx on public.time_clock_entries(user_id) where clock_out is null;

alter table public.time_clock_entries enable row level security;

drop policy if exists tce_self_select on public.time_clock_entries;
create policy tce_self_select on public.time_clock_entries
  for select to authenticated using (user_id = auth.uid());
drop policy if exists tce_self_insert on public.time_clock_entries;
create policy tce_self_insert on public.time_clock_entries
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists tce_self_update on public.time_clock_entries;
create policy tce_self_update on public.time_clock_entries
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists tce_staff_all on public.time_clock_entries;
create policy tce_staff_all on public.time_clock_entries
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select, insert, update on public.time_clock_entries to authenticated;
