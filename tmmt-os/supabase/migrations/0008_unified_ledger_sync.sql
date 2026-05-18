-- Unified ledger: team, investors, and vendors post expenses; clients see synced billing.

alter table public.rental_ledger
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists source text not null default 'team',
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists customer_name text,
  add column if not exists visible_to_client boolean not null default true;

create index if not exists rental_ledger_created_idx on public.rental_ledger(created_at desc);
create index if not exists rental_ledger_org_idx on public.rental_ledger(organization_id);

comment on column public.rental_ledger.source is 'team | investor | vendor | system';
comment on column public.rental_ledger.visible_to_client is 'When false, internal/partner only';

-- Clients: only rows marked visible
drop policy if exists rental_ledger_client_read on public.rental_ledger;
create policy rental_ledger_client_read on public.rental_ledger for select
  using (
    visible_to_client = true
    and lower(customer_email) = lower(public.current_profile_email())
  );

-- Investors: read all rental financials (fleet P&L); insert as investor
drop policy if exists rental_ledger_investor_read on public.rental_ledger;
create policy rental_ledger_investor_read on public.rental_ledger for select
  using (public.current_role() = 'investor' or public.is_admin());

drop policy if exists rental_ledger_investor_insert on public.rental_ledger;
create policy rental_ledger_investor_insert on public.rental_ledger for insert
  with check (public.current_role() in ('investor', 'admin'));

drop policy if exists rental_ledger_investor_update on public.rental_ledger;
create policy rental_ledger_investor_update on public.rental_ledger for update
  using (public.current_role() in ('investor', 'admin'))
  with check (public.current_role() in ('investor', 'admin'));

-- Vendors (partners): cases they are assigned on
drop policy if exists rental_ledger_vendor_read on public.rental_ledger;
create policy rental_ledger_vendor_read on public.rental_ledger for select
  using (
    public.current_role() = 'vendor'
    and (
      case_id in (
        select vj.case_id from public.vendor_jobs vj
        join public.vendors v on v.id = vj.vendor_id
        where v.profile_id = auth.uid() and vj.case_id is not null
      )
      or created_by = auth.uid()
    )
  );

drop policy if exists rental_ledger_vendor_insert on public.rental_ledger;
create policy rental_ledger_vendor_insert on public.rental_ledger for insert
  with check (
    public.current_role() = 'vendor'
    and (
      case_id is null
      or case_id in (
        select vj.case_id from public.vendor_jobs vj
        join public.vendors v on v.id = vj.vendor_id
        where v.profile_id = auth.uid() and vj.case_id is not null
      )
    )
  );

-- Realtime — skip silently if publication missing or table already added
do $$ begin
  alter publication supabase_realtime add table public.rental_ledger;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
