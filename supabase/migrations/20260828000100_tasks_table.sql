-- The internal to-do list.
--
-- Like the sensitive-table lock, this records schema that is ALREADY LIVE on
-- uapxakmlwnpfsftfeezx. The table was created directly on 2026-08-25 and its
-- migration never reached this repo — it stayed on a shallow clone that has no
-- common ancestor with master. A fresh deploy would come up without the table
-- while the /tasks page expected it.
--
-- Transcribed from the live database, not from the 2026-08-25 draft. The draft
-- shipped `auth_all_tasks ... USING (true)`, which since host-based tenancy
-- (#176 / #178) would hand every authenticated operator and partner the house
-- to-do list. Production has already been tightened to org scoping, and that is
-- what is written down here.

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  status      text default 'To Do'   check (status   in ('To Do','In Progress','Done','Blocked')),
  priority    text default 'Medium'  check (priority in ('High','Medium','Low')),
  assigned_to text,
  due_date    date,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Org scoping. The default keeps existing call sites working: acting_org_id()
-- for a signed-in operator, otherwise the house org.
alter table public.tasks
  add column if not exists org_id uuid
  default coalesce(acting_org_id(), '8e651b25-e7c8-4356-af64-1716a82053b0'::uuid);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tasks'::regclass and conname = 'tasks_org_id_fkey'
  ) then
    alter table public.tasks
      add constraint tasks_org_id_fkey foreign key (org_id) references public.organizations(id);
  end if;
end $$;

-- updated_at stays current. search_path is pinned so the function cannot be
-- hijacked through a mutable search_path; now() resolves from pg_catalog, which
-- is always implicitly searched.
create or replace function public.tasks_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.tasks_set_updated_at();

alter table public.tasks enable row level security;

drop policy if exists auth_all_tasks on public.tasks;  -- the draft's open policy, if present
drop policy if exists tasks_org_all  on public.tasks;
create policy tasks_org_all on public.tasks
  as permissive for all to authenticated
  using       (public.is_platform_admin() or public.is_org_member(org_id))
  with check  (public.is_platform_admin() or public.is_org_member(org_id));
