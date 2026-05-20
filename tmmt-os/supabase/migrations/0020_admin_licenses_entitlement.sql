-- Admin UI: organization license provisioning (Phase 2)

insert into public.entitlements (slug, name, category, portal) values
  ('admin_licenses', 'Organization licenses', 'admin', 'admin')
on conflict (slug) do nothing;
