-- Run in Supabase SQL Editor AFTER 0001_init.sql (profiles table exists).
-- Replace email before running.

update public.profiles
set role = 'admin'
where email = 'YOUR_EMAIL@example.com';

select id, email, role from public.profiles where email = 'YOUR_EMAIL@example.com';
