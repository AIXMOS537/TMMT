-- Portal (lock app) reads verified GHL pipeline state from one view.

create or replace view public.renter_pipeline_status as
select
  r.id as sync_record_id,
  r.ghl_contact_id,
  r.ghl_opportunity_id,
  r.ghl_pipeline_name,
  r.ghl_stage,
  r.canonical_stage,
  r.business_line,
  r.customer_name,
  r.customer_email,
  r.customer_phone,
  r.case_id,
  r.airtable_record_id,
  r.verified_at,
  r.updated_at
from public.crm_sync_records r
where r.sync_status = 'verified';

comment on view public.renter_pipeline_status is
  'Lock app (Rentals Portal): one row per verified GHL sync — use canonical_stage for pipeline UI.';

grant select on public.renter_pipeline_status to authenticated;
