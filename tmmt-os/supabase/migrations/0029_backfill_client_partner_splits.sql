-- One-time backfill: agency client orgs without a split → passive 50/50 (hands-off default).
-- Re-run safe: only updates rows where partner_client_segment is null.

update public.organizations
set
  partner_client_segment = 'business_owner',
  partner_revenue_split_tier = '50_50',
  partner_has_own_system = false,
  partner_split_auto_track = true
where parent_agency_id is not null
  and partner_client_segment is null;
