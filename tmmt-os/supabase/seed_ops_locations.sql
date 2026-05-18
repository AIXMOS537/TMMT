-- Example ops location — replace [FILL] placeholders before production use.
insert into public.ops_locations (
  slug,
  name,
  ghl_pipeline_id,
  ghl_pipeline_name,
  clickup_list_id,
  overseas_assignee_email,
  courier_prefs,
  active
) values (
  'dallas',
  'Dallas / DFW',
  '[FILL_GHL_PIPELINE_ID]',
  'TMMT Dispatch — Dallas',
  '[FILL_CLICKUP_LIST_ID]',
  '[FILL_OVERSEAS_EMAIL]',
  '{"preferred": ["local_partner_a"], "notes": "Default Dallas courier prefs"}'::jsonb,
  true
)
on conflict (slug) do update set
  name = excluded.name,
  ghl_pipeline_id = excluded.ghl_pipeline_id,
  ghl_pipeline_name = excluded.ghl_pipeline_name,
  clickup_list_id = excluded.clickup_list_id,
  overseas_assignee_email = excluded.overseas_assignee_email,
  courier_prefs = excluded.courier_prefs,
  active = excluded.active,
  updated_at = now();
