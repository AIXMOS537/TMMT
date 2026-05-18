-- Run in Supabase SQL Editor AFTER migrations:
--   0005a_profiles_bootstrap.sql (if no profiles table)
--   0005_portals_entitlements.sql
--   client_cases_rls (applied via MCP or supabase/migrations/0006_client_cases_rls.sql)

-- Super Admin (replace email)
update public.profiles
set portal_role = 'super_admin', admin_scope = 'super', role = 'admin'
where email = 'aixmos@icloud.com';

-- Sales rep
update public.profiles
set portal_role = 'team_member', team_department = 'sales', role = 'internal_team'
where email = 'management@tmmtrentals.net';

-- Growth client
update public.profiles
set portal_role = 'client',
    package_id = (select id from public.packages where slug = 'growth')
where email = 'partner-portal-test@tmmt-rentals.local';

-- Starter client example (uncomment and set email)
-- update public.profiles
-- set portal_role = 'client',
--     package_id = (select id from public.packages where slug = 'starter')
-- where email = 'client@example.com';

-- Finance admin example
-- update public.profiles
-- set portal_role = 'admin', admin_scope = 'finance', role = 'admin'
-- where email = 'cfo@example.com';

select
  email,
  role,
  portal_role,
  admin_scope,
  team_department,
  (select slug from public.packages where id = profiles.package_id) as package
from public.profiles
order by email;
