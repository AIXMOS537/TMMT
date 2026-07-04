-- gated_actions — persistence for the owner-approval queue.
--
-- Backs shared/owner-approval-gate (assertApproved) and the held SMS replies
-- from /api/agent/sms/inbound. An action is created PENDING, surfaced to the
-- owner, and only an APPROVED action may execute. See root CLAUDE.md §2.
--
-- STATUS: reviewable file for owner approval — NOT auto-applied. Apply through
-- the normal migration flow after review.
--
-- Idempotent: safe to re-run.

create table if not exists public.gated_actions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid,
  type        text not null,
  payload     jsonb not null default '{}'::jsonb,
  status      text not null default 'pending'
              check (status in ('pending','approved','rejected','sent','failed')),
  created_by  text not null,
  approved_by text,
  approved_at timestamptz,
  reason      text,
  sent_ref    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists gated_actions_org_status_idx
  on public.gated_actions (org_id, status, created_at desc);

-- RLS: owner/staff read + decide; org members read their own org; service-role
-- (the agent + endpoint) does the writes. Mirrors the tenant-scope convention.
alter table public.gated_actions enable row level security;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'is_staff') then
    drop policy if exists gated_actions_read on public.gated_actions;
    create policy gated_actions_read on public.gated_actions for select to authenticated
      using (
        public.is_staff()
        or (org_id is not null and public.is_org_member(org_id))
      );

    -- No authenticated UPDATE policy: decisions (approve/reject) MUST go through
    -- POST /api/agent/approvals/[id], which enforces owner-only auth and does
    -- the write as the service role. A direct staff JWT cannot flip status here,
    -- so the approval trail can't be forged by a non-owner via PostgREST.
    drop policy if exists gated_actions_decide on public.gated_actions;
  else
    raise notice 'is_staff()/is_org_member() helpers absent — apply tenant-scope migration first; leaving gated_actions service-role-only';
  end if;
end$$;

-- keep updated_at fresh
create or replace function public.gated_actions_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists gated_actions_touch on public.gated_actions;
create trigger gated_actions_touch
  before update on public.gated_actions
  for each row execute function public.gated_actions_touch_updated_at();
