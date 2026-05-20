-- DEV ONLY — do not run on production. Creates DEMO-4242 vehicle + sample booking.
-- Demo rental seed — vehicle + active booking + pipeline row for client vehicle hub
-- Run in Supabase SQL Editor AFTER migrations 0004, 0007, 0010 (and CRM sync if using pipeline view).
--
-- 1) Set the client email (must match a real profile / login you use for demos):
-- 2) Run the whole script.

do $$
declare
  demo_email text := 'partner-portal-test@tmmt-rentals.local';  -- <<< CHANGE THIS
  v_vehicle_id uuid;
  v_booking_id uuid;
  v_profile_id uuid;
begin
  select id into v_profile_id from public.profiles where lower(email) = lower(demo_email) limit 1;

  insert into public.vehicles (label, make, model, year, plate, daily_rate, active, metadata)
  values (
    '2024 Tesla Model 3 — Demo Unit',
    'Tesla',
    'Model 3',
    2024,
    'DEMO-4242',
    89.00,
    true,
    '{"demo": true}'::jsonb
  )
  returning id into v_vehicle_id;

  if v_vehicle_id is null then
    select id into v_vehicle_id from public.vehicles where plate = 'DEMO-4242' limit 1;
  end if;

  insert into public.bookings (
    profile_id,
    vehicle_id,
    customer_name,
    customer_email,
    customer_phone,
    status,
    starts_at,
    ends_at,
    metadata
  )
  values (
    v_profile_id,
    v_vehicle_id,
    'Demo Renter',
    demo_email,
    '+1-555-0100',
    'active',
    now() - interval '3 days',
    now() + interval '11 days',
    '{"demo": true, "source": "seed_demo_rental"}'::jsonb
  )
  returning id into v_booking_id;

  insert into public.rental_ledger (
    customer_email,
    profile_id,
    booking_id,
    entry_type,
    status,
    title,
    description,
    amount_cents,
    visible_to_client,
    metadata
  )
  values
    (
      demo_email,
      v_profile_id,
      v_booking_id,
      'deposit',
      'pending',
      'Security deposit',
      'Refundable after inspection',
      50000,
      true,
      '{"demo": true}'::jsonb
    ),
    (
      demo_email,
      v_profile_id,
      v_booking_id,
      'payment',
      'completed',
      'Weekly rental payment',
      'Week 1',
      62300,
      true,
      '{"demo": true}'::jsonb
    );

  -- Optional: sample damage visible on /client/vehicle (requires 0010)
  insert into public.vehicle_damage_reports (
    booking_id,
    vehicle_id,
    customer_email,
    title,
    description,
    severity,
    status,
    visible_to_client
  )
  values (
    v_booking_id,
    v_vehicle_id,
    demo_email,
    'Minor curb rash — passenger rear',
    'Documented at pickup. No structural damage.',
    'minor',
    'reported',
    true
  );

  -- Pipeline status for rental hub (requires crm_sync_records + renter view)
  insert into public.crm_sync_records (
    ghl_contact_id,
    ghl_opportunity_id,
    ghl_pipeline_id,
    ghl_pipeline_name,
    ghl_stage,
    canonical_stage,
    business_line,
    customer_name,
    customer_email,
    sync_status,
    verified_at,
    payload
  )
  values (
    'demo-ghl-contact',
    'demo-ghl-opportunity',
    'demo-pipeline',
    'TMMT Rentals',
    'Active Rental',
    'active_renter',
    'rentals',
    'Demo Renter',
    demo_email,
    'verified',
    now(),
    '{"demo": true}'::jsonb
  )
  on conflict (ghl_contact_id, ghl_opportunity_id, ghl_pipeline_id) do update set
    canonical_stage = excluded.canonical_stage,
    ghl_stage = excluded.ghl_stage,
    sync_status = 'verified',
    verified_at = now(),
    customer_email = excluded.customer_email;

  raise notice 'Demo seed complete for %. Vehicle %, booking %', demo_email, v_vehicle_id, v_booking_id;
end $$;
