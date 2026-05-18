-- Ops command: staff assignment + routing fields on cases (idempotent)

alter table public.cases
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists work_type text,
  add column if not exists routing_status text default 'pending',
  add column if not exists clickup_task_id text,
  add column if not exists clickup_task_url text;

create index if not exists cases_assigned_to_idx on public.cases(assigned_to);
