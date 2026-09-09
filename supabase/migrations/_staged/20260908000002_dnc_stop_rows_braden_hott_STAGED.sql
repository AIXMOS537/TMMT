-- STAGED — NOT APPLIED. Production write → owner seal (Chain of Trust).
-- Purpose: two customers sent STOP but have no row in public.do_not_contact_numbers
--          (found by M1 Rick, RECOVERY-M1-REPORT-20260908 §3): James Braden (…8055), Dominique Hott (…9845).
-- Safety: matches on name AND on the known last-4 digits; inserts only when exactly one phone resolves
--         per person; idempotent (skips if phone10 already present); every step NOTICEs what it did.
-- Rollback: DELETE FROM public.do_not_contact_numbers WHERE source = 'stop-recorded-20260908';
-- Owner apply: paste into the Supabase SQL editor (or supabase db query) in YOUR session, then run the
--              verification SELECT at the bottom. Do not run from an agent.

DO $$
DECLARE
  r record;
  v_phone10 text;
  v_hits int;
  v_cols text;
  v_has_source boolean;
  v_has_reason boolean;
  v_has_org boolean;
BEGIN
  IF to_regclass('public.do_not_contact_numbers') IS NULL THEN
    RAISE EXCEPTION 'do_not_contact_numbers does not exist — stop';
  END IF;
  IF to_regclass('public.ghl_contacts') IS NULL THEN
    RAISE EXCEPTION 'ghl_contacts does not exist — resolve phones by hand instead';
  END IF;

  SELECT bool_or(column_name='source'), bool_or(column_name='reason'), bool_or(column_name='organization_id')
    INTO v_has_source, v_has_reason, v_has_org
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='do_not_contact_numbers';

  -- name columns present on ghl_contacts, concatenated for a case-insensitive match
  SELECT string_agg(format('coalesce(%I::text,'''')', column_name), ' || '' '' || ')
    INTO v_cols
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ghl_contacts'
     AND column_name IN ('first_name','last_name','full_name','name','contact_name');
  IF v_cols IS NULL THEN
    RAISE EXCEPTION 'ghl_contacts has no recognised name column — resolve phones by hand';
  END IF;

  FOR r IN SELECT * FROM (VALUES ('james braden','8055'), ('dominique hott','9845')) AS t(who, last4) LOOP
    EXECUTE format(
      'SELECT count(DISTINCT right(regexp_replace(phone::text, ''\D'', '''', ''g''), 10)),
              min(right(regexp_replace(phone::text, ''\D'', '''', ''g''), 10))
         FROM public.ghl_contacts
        WHERE lower(%s) LIKE %L
          AND right(regexp_replace(phone::text, ''\D'', '''', ''g''), 4) = %L',
      v_cols, '%' || r.who || '%', r.last4)
    INTO v_hits, v_phone10;

    IF v_hits <> 1 OR v_phone10 IS NULL OR length(v_phone10) <> 10 THEN
      RAISE NOTICE 'SKIP % — % candidate phone(s) ending %; resolve by hand', r.who, v_hits, r.last4;
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM public.do_not_contact_numbers WHERE phone10 = v_phone10) THEN
      RAISE NOTICE 'already on DNC: % (…%)', r.who, r.last4;
      CONTINUE;
    END IF;

    EXECUTE format(
      'INSERT INTO public.do_not_contact_numbers (phone10%s%s) VALUES (%L%s%s)',
      CASE WHEN v_has_source THEN ', source' ELSE '' END,
      CASE WHEN v_has_reason THEN ', reason' ELSE '' END,
      v_phone10,
      CASE WHEN v_has_source THEN ', ''stop-recorded-20260908''' ELSE '' END,
      CASE WHEN v_has_reason THEN ', ''customer replied STOP; recorded late (M1 audit 2026-09-08)''' ELSE '' END);
    RAISE NOTICE 'INSERTED DNC row for % (…%)', r.who, r.last4;
  END LOOP;
END $$;

-- Verification (run after): both last-4s must appear.
SELECT phone10, * FROM public.do_not_contact_numbers
 WHERE right(phone10, 4) IN ('8055', '9845');
