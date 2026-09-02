-- People spine: one human, many forms, many ops tables.
-- Staff can read. Anon cannot. Service role writes from the form API.

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  email text,
  phone_e164 text,
  phone_digits text,
  source_first text,
  source_last text,
  tenant_slug text not null default 'aixmos',
  ghl_contact_id text,
  incoming_lead_id uuid,
  active_customer_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists people_email_uniq
  on public.people (lower(email))
  where email is not null and length(trim(email)) > 0;

create unique index if not exists people_phone_uniq
  on public.people (phone_digits)
  where phone_digits is not null and length(phone_digits) >= 7;

create index if not exists people_ghl_idx on public.people (ghl_contact_id)
  where ghl_contact_id is not null;

create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.people(id) on delete set null,
  form_slug text not null,
  tenant_slug text not null default 'aixmos',
  site text not null check (site in ('aixmos', 'tmmt')),
  destination_table text,
  destination_id uuid,
  payload jsonb not null default '{}'::jsonb,
  landing_url text,
  created_at timestamptz not null default now()
);

create index if not exists form_submissions_person_idx on public.form_submissions (person_id, created_at desc);
create index if not exists form_submissions_slug_idx on public.form_submissions (form_slug, created_at desc);

alter table public.people enable row level security;
alter table public.form_submissions enable row level security;

drop policy if exists people_staff_read on public.people;
create policy people_staff_read on public.people
  for select to authenticated
  using (public.is_staff());

drop policy if exists people_staff_write on public.people;
create policy people_staff_write on public.people
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists form_submissions_staff_read on public.form_submissions;
create policy form_submissions_staff_read on public.form_submissions
  for select to authenticated
  using (public.is_staff());

revoke all on public.people from anon;
revoke all on public.form_submissions from anon;
grant select on public.people to authenticated;
grant select on public.form_submissions to authenticated;

-- Backfill: GHL contacts, then incoming leads, then active renters.
insert into public.people (full_name, email, phone_digits, phone_e164, source_first, source_last, tenant_slug, ghl_contact_id)
select
  nullif(trim(c.full_name), ''),
  nullif(lower(trim(c.email)), ''),
  nullif(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), ''),
  case
    when length(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g')) = 10
      then '+1' || regexp_replace(c.phone, '\D', '', 'g')
    when length(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g')) >= 11
      then '+' || regexp_replace(c.phone, '\D', '', 'g')
    else null
  end,
  'ghl_contacts',
  'ghl_contacts',
  'aixmos',
  c.ghl_contact_id
from public.ghl_contacts c
where (c.email is not null and length(trim(c.email)) > 3)
   or (c.phone is not null and length(regexp_replace(c.phone, '\D', '', 'g')) >= 7)
on conflict do nothing;

insert into public.people (full_name, email, phone_digits, source_first, source_last, tenant_slug, incoming_lead_id)
select
  nullif(trim(l.contact_name), ''),
  nullif(lower(trim(l.email)), ''),
  coalesce(nullif(regexp_replace(coalesce(l.phone_e164, l.phone_text, ''), '\D', '', 'g'), ''), l.phone::text),
  'incoming_leads',
  'incoming_leads',
  'tmmt_property',
  l.id
from public.incoming_leads l
where (l.email is not null and length(trim(l.email)) > 3)
   or l.phone is not null
on conflict do nothing;

insert into public.people (full_name, email, phone_digits, source_first, source_last, tenant_slug, active_customer_id)
select
  nullif(trim(a.customer_name), ''),
  nullif(lower(trim(a.contact_email)), ''),
  nullif(regexp_replace(coalesce(a.contact_phone, ''), '\D', '', 'g'), ''),
  'active_customers',
  'active_customers',
  'tmmt_property',
  a.id
from public.active_customers a
where (a.contact_email is not null and length(trim(a.contact_email)) > 3)
   or (a.contact_phone is not null and length(regexp_replace(a.contact_phone, '\D', '', 'g')) >= 7)
on conflict do nothing;
