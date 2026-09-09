-- 20260909180000_venture_scoping_STAGED.sql
--
-- WHAT THIS IS FOR
--   The product is one dealership running many ventures — rentals today, then
--   detailing, chauffeur, whatever comes next — all managed in one app. The
--   `ventures` table already says so: its comment reads "Portfolio businesses
--   hosted in the command center; TMMT Rentals is venture #1."
--
--   But no operational table carries a venture column. Measured 2026-09-09:
--   `venture_id` appears in ZERO migrations. So venture #1 implicitly owns
--   every row, and the moment a second venture is created it would see the
--   first one's fleet, contracts, tickets and customers. The multi-venture
--   platform exists as a table and nothing else.
--
--   This adds the column and backfills it. It deliberately stops short of
--   enforcement — see "WHAT THIS DELIBERATELY DOES NOT DO".
--
-- SAFETY
--   Additive only: a nullable column with a foreign key and an index, per
--   table. No column is dropped, no row is deleted, no policy changes. Every
--   step is guarded, so re-running is a no-op and a missing table is a NOTICE
--   rather than a failure.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   * It does NOT set NOT NULL. A writer that does not yet know about ventures
--     would start failing the instant this applied.
--   * It does NOT touch RLS. Isolation between ventures is a policy change, and
--     policies here are load-bearing (338 of them). That is a second migration,
--     written once the app actually sets venture_id on write, and reviewed on
--     its own.
--   Backfilling to venture #1 is correct precisely BECAUSE one venture is live:
--   every existing row genuinely belongs to it. Applying this after a second
--   venture has been created would silently mislabel that venture's rows.
--   Apply it before venture #2 exists, or not at all.

-- REHEARSED 2026-09-09 in a throwaway database inside BRAINIAC's `tmmt-postgres`
-- container (never production), against a fixture of ventures + fleet(43) +
-- tickets(308) + contracts(2):
--   UP      -> columns added, 43/43, 308/308, 2/2 backfilled, absent tables skipped as NOTICE
--   UP again-> "venture_id already present", 0 rows re-backfilled, index skip is a NOTICE
--   2 ventures present -> RAISES, changes nothing:
--       ERROR: REFUSING: 2 ventures exist. Backfilling every row to one of them
--       would mislabel the others.
-- The throwaway database was dropped afterwards.

DO $$
DECLARE
  v_venture uuid;
  t text;
  n bigint;
  tables text[] := ARRAY[
    'fleet', 'active_customers', 'former_customers', 'contracts', 'tickets',
    'incoming_leads', 'waitlist', 'insurance', 'fleet_car_inspections',
    'maintenance_appointments', 'expenses', 'operation_costs',
    'do_not_rent_list', 'vendors', 'appointments', 'customer_payments'
  ];
BEGIN
  IF to_regclass('public.ventures') IS NULL THEN
    RAISE NOTICE 'SKIP: public.ventures does not exist; nothing to scope to.';
    RETURN;
  END IF;

  SELECT id INTO v_venture FROM public.ventures ORDER BY created_at NULLS LAST, id LIMIT 1;
  IF v_venture IS NULL THEN
    RAISE NOTICE 'SKIP: public.ventures is empty; no venture to backfill to.';
    RETURN;
  END IF;

  IF (SELECT count(*) FROM public.ventures) > 1 THEN
    RAISE EXCEPTION
      'REFUSING: % ventures exist. Backfilling every row to one of them would mislabel the others. Scope them deliberately instead.',
      (SELECT count(*) FROM public.ventures);
  END IF;

  RAISE NOTICE 'Backfilling to venture %', v_venture;

  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE '  skip %: table does not exist', t;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'venture_id'
    ) THEN
      RAISE NOTICE '  skip %: venture_id already present', t;
    ELSE
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN venture_id uuid REFERENCES public.ventures(id) ON DELETE RESTRICT',
        t);
      EXECUTE format(
        'COMMENT ON COLUMN public.%I.venture_id IS %L', t,
        'Which venture owns this row. Nullable until every writer sets it; see _staged/20260909180000.');
      RAISE NOTICE '  added venture_id to %', t;
    END IF;

    EXECUTE format('UPDATE public.%I SET venture_id = $1 WHERE venture_id IS NULL', t) USING v_venture;
    GET DIAGNOSTICS n = ROW_COUNT;

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (venture_id)',
      t || '_venture_id_idx', t);

    RAISE NOTICE '  % backfilled: % row(s)', t, n;
  END LOOP;

  RAISE NOTICE 'Done. venture_id is NULLABLE and no RLS policy reads it yet — isolation is a separate, later migration.';
END $$;
