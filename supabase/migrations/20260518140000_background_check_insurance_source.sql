-- Background check: insurance coverage source (own vs internal vs corporate non-owner)

alter table public.background_checks
  add column if not exists insurance_coverage_source text,
  add column if not exists insurance_policy_carrier text,
  add column if not exists insurance_policy_number text,
  add column if not exists insurance_risk_score smallint;

comment on column public.background_checks.insurance_coverage_source is
  'renter_own | tmmt_internal | corporate_non_owner';
