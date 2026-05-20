-- Grant starter package credit rebuild + upgrade for journey path

insert into public.package_entitlements (package_id, entitlement_slug)
select p.id, e.slug
from public.packages p
cross join (values ('training_credit_rebuild'), ('upgrade_center')) as e(slug)
where p.slug = 'starter'
on conflict do nothing;
