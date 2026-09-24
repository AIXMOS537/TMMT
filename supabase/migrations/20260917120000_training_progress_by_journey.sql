-- Gates 30 and 40 of the Drive-to-Own ladder: a renter with no account needs somewhere to
-- record training progress.
--
-- SAME TRAP AS GATE 10, SAME SHAPE OF FIX. `training_module_progress.profile_id` is NOT
-- NULL, and verified in production 2026-09-17 **0 of 35 `client_journey` rows carry a
-- profile_id** — renters have never had accounts. So `training_path_started` (30) and
-- `training_core_complete` (40) were unevidencable for every renter, exactly as
-- `credit_education_acknowledged` (10) was before 20260917010000.
--
-- WHAT DOES *NOT* NEED FIXING, checked rather than assumed:
--   credit_enrollments.journey_id        NOT NULL — already journey-keyed (gate 20 ✓)
--   journey_checkpoint_events.journey_id NOT NULL — already journey-keyed ✓
-- Only training carried the profile-only assumption.

begin;

alter table public.training_module_progress
  add column if not exists journey_id uuid references public.client_journey(id) on delete cascade;

-- Without this the column above is unusable: a journey-only row cannot be inserted.
-- Not a weakening — the CHECK below still requires a subject on every row.
alter table public.training_module_progress
  alter column profile_id drop not null;

comment on column public.training_module_progress.journey_id is
  'The renter''s journey. Used when the renter has no account (the normal case). Either this or profile_id identifies who the progress belongs to.';

create index if not exists training_progress_journey_idx
  on public.training_module_progress (journey_id, module_id);

-- One progress row per renter per module. Without it a second write creates a duplicate and
-- a renter appears to have completed more modules than exist — the same defect the
-- education unique index prevents.
create unique index if not exists training_progress_journey_module_uniq
  on public.training_module_progress (journey_id, module_id)
  where journey_id is not null;

alter table public.training_module_progress
  drop constraint if exists training_progress_has_subject;
alter table public.training_module_progress
  add constraint training_progress_has_subject
  check (journey_id is not null or profile_id is not null);

-- percent_complete is a percentage. Nothing enforced that, so 250% or -10 could be stored
-- and would read as "complete" to any `>= 100` check.
alter table public.training_module_progress
  drop constraint if exists training_progress_percent_range;
alter table public.training_module_progress
  add constraint training_progress_percent_range
  check (percent_complete between 0 and 100);

commit;
