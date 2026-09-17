-- Let a public visitor record a service opt-in.
--
-- customer_services carried only `authenticated` policies (org_read_customer_services,
-- staff_all_customer_services), so an anonymous submission of the waitlist form was
-- rejected by row-level security. The person saw "You're on the List!", the failure went
-- to a server log, and no row was written. The table has 0 rows and had never been
-- written to once — this is why.
--
-- Modelled on anon_insert_leads, NOT on anon_insert_waitlist. That one is
-- WITH CHECK (true), which would let anyone write any row into this table. A service row
-- is a consent record and it drives follow-up, so the anon path is bounded to exactly
-- what the public form can legitimately produce:
--
--   * status is forced to 'requested' — nobody promotes themselves to enrolled/active
--   * channel is limited to the public forms that may create one
--   * tier stays NULL — a tier is something the business grants, never something
--     the visitor claims
--   * org_id and entity_id stay NULL — anon may not attach a row to an existing
--     organisation or customer record
--   * lengths are capped so the table cannot be used as free storage
--
-- INSERT only. anon still cannot read, update, or delete; staff policies are untouched.

drop policy if exists anon_insert_customer_services on public.customer_services;

create policy anon_insert_customer_services
  on public.customer_services
  for insert
  to anon
  with check (
    status = 'requested'
    and channel in ('waitlist-form', 'lead-intake-form')
    and tier is null
    and org_id is null
    and entity_id is null
    and length(coalesce(customer_name, '')) <= 200
    and length(coalesce(contact_phone, '')) <= 40
    and length(coalesce(contact_email, '')) <= 254
    and length(coalesce(service_slug, '')) <= 60
    and length(coalesce(service_name, '')) <= 120
  );
