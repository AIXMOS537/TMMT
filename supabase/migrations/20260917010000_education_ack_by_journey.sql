-- A renter with no account needs somewhere to put their credit-education acknowledgement.
--
-- THE PROBLEM. `credit_education_acknowledgments` keys on `profile_id`, and
-- VERIFIED IN PRODUCTION 2026-09-16: **0 of 35 `client_journey` rows carry a profile_id**,
-- because renters have never had accounts. Gate 10 of the Drive-to-Own ladder
-- (`credit_education_acknowledged`) is therefore unevidencable for every renter alive --
-- the FIRST gate, so nobody can take a single step.
--
-- THE FIX. Accept a journey_id as well. Additive and nullable: every existing row and
-- every profile-based write keeps working untouched. The reader counts across both keys.
--
-- Deliberately NOT done: backfilling profile_id, or creating accounts for 35 renters. The
-- journey IS the renter's identity in this product; forcing an account to record that
-- someone read three pages would be building an auth system to answer the wrong question.

begin;

alter table public.credit_education_acknowledgments
  add column if not exists journey_id uuid references public.client_journey(id) on delete cascade;

-- profile_id is NOT NULL today (verified production 2026-09-16), which makes a
-- journey-only acknowledgement literally impossible to insert. Dropping the NOT NULL is
-- what actually unblocks gate 10. It is NOT a weakening: the CHECK added below requires a
-- subject either way, so every row still identifies exactly who acknowledged.
alter table public.credit_education_acknowledgments
  alter column profile_id drop not null;

comment on column public.credit_education_acknowledgments.journey_id is
  'The renter''s journey. Used when the renter has no account (the normal case). Either this or profile_id identifies who acknowledged.';

create index if not exists credit_education_ack_journey_idx
  on public.credit_education_acknowledgments (journey_id, section_id);

-- One acknowledgement per renter per section. Without this a double-tap counts twice and
-- a renter appears to have completed more sections than exist.
create unique index if not exists credit_education_ack_journey_section_uniq
  on public.credit_education_acknowledgments (journey_id, section_id)
  where journey_id is not null;

-- An acknowledgement that identifies nobody is not evidence of anything.
alter table public.credit_education_acknowledgments
  drop constraint if exists credit_education_ack_has_subject;
alter table public.credit_education_acknowledgments
  add constraint credit_education_ack_has_subject
  check (journey_id is not null or profile_id is not null);

commit;
