-- Resume the fleet -> vehicles bridge that stalled on 2026-06-26.
--
-- ⚠️ NOT APPLIED, AND IT NEEDS A PRICING DECISION FIRST. See §2.
--
-- WHY THIS MATTERS MORE THAN IT LOOKS
-- public.bookings.vehicle_id is a FK to public.vehicles(id). `vehicles` holds
-- TWO rows. `fleet` — the real inventory — holds 43. So the booking write path
-- added today (src/lib/rental-pricing/create-booking.ts) can physically only
-- book 2 of 43 cars. This bridge is the blocker on the whole rental lane.
--
-- WHAT ALREADY HAPPENED
-- A bridge ran once on 2026-06-26 06:44:19 and stopped after two vehicles:
--   2017 Toyota Camry   tier economy  weekly_rate 350  daily 50.00
--   2013 Lexus RX450H   tier mid      weekly_rate 400  daily 57.14
-- Both carry metadata {"source":"fleet_bridge"}. Note that both took their
-- weekly_rate from the car's REAL posted price (350, 400) and not from
-- rental_pricing_rules (which would have said 280 and 470). Whoever wrote that
-- bridge reached the same conclusion as fleet-rate.ts: the car's own price wins.
-- This file follows the identical convention: daily_rate = weekly_rate / 7.
--
-- SCOPE, read from production 2026-09-16:
--   43 fleet rows total
--    2 already bridged
--    8 Retired or make-less  -> deliberately skipped
--   33 candidates, of which 26 have a real posted weekly price
--    7 have NO price at all  -> skipped here, they cannot be priced honestly
--
-- ⚠️ A SOBER NOTE ON INVENTORY
-- Of all 43 cars, exactly TWO are currently vehicle_status = 'Available', and
-- only one of those carries a price (2017 Toyota Camry, $400/wk). Every other
-- car is Rented, Under Maintenance, Coming Soon, or Retired. Bridging the fleet
-- makes the booking engine real, but it does not by itself create sellable
-- inventory. Do not read a successful run of this file as "33 cars for rent".

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Idempotency. Re-running must never duplicate a vehicle.
--    fleet_vehicle_id is the bridge key; make it unique so a second run is a
--    no-op rather than a mess. (Partial: the two pre-bridge rows are fine.)
-- ─────────────────────────────────────────────────────────────────────────────
create unique index if not exists vehicles_fleet_vehicle_id_key
  on public.vehicles (fleet_vehicle_id)
  where fleet_vehicle_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ⛔ THE DECISION X HAS TO MAKE: TIER.
--
-- `vehicles.tier` drives which rental_pricing_rules row a car can match, so it
-- is a PRICING decision, not a data-cleanup decision. I will not guess it.
--
-- It CANNOT be derived from fleet.vehicle_class: only 3 of 43 rows have one and
-- all three are wrong in production today (a Tesla Model 3 filed as
-- "sport_bike", a 2013 Corolla as "sport_car", a Model Y as "sport_suv").
--
-- Below is a PROPOSAL based on the existing precedent (2017 Camry = economy,
-- 2013 Lexus RX450H = mid) and on each car's own posted price. Edit it before
-- running. Anything not listed falls to 'economy'.
-- ─────────────────────────────────────────────────────────────────────────────
create temporary table tier_overrides (make text, model text, tier vehicle_tier) on commit drop;

insert into tier_overrides (make, model, tier) values
  -- Proposed 'mid': premium badges and the larger SUVs/vans, matching the
  -- Lexus RX450H precedent already in `vehicles`.
  ('Lexus',      null,       'mid'),
  ('BMW',        null,       'mid'),
  ('Tesla',      null,       'mid'),
  ('Volkswagon', 'Atlas',    'mid'),
  ('Toyota',     'Sienna',   'mid'),
  ('Dodge',      'Caravan',  'mid'),
  ('Honda',      'CRV',      'mid'),
  ('Toyota',     'Rav 4',    'mid'),
  ('Ford',       'Edge',     'mid'),
  ('Mitsubishi', 'Outlander','mid');
  -- Everything else -> 'economy' (Corolla, Camry, Accent, Versa, Focus, ...).
  -- No car in this fleet is proposed as 'luxury'.
  --
  -- ⚠️ KNOWN INCONSISTENCY IN THIS PROPOSAL — X's call which way to resolve it.
  -- rental_pricing_rules files Tesla Model 3 and Model Y under tier='economy'
  -- (match_priority 20, $550/$590 a week). Putting Tesla in 'mid' above means
  -- those two seeded rules can never match, because rule matching requires the
  -- tiers to be equal. It does not misprice anything today — the car's own
  -- posted price wins over the card either way (see fleet-rate.ts) — but it
  -- does leave two rate-card rows permanently dead.
  --   Option A: drop the ('Tesla', null) override, leaving Tesla in 'economy'
  --             so the seeded Tesla rules become live.
  --   Option B: keep Tesla in 'mid' and re-tier those two rules to match.
  -- Either is defensible. Pick one deliberately rather than inheriting this.

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. The bridge itself.
--
-- Only cars with a real posted weekly price are bridged. A car with no price
-- would have to inherit the tier card, and the tier card underprices this
-- fleet — that is the exact bug this whole change set exists to prevent.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.vehicles (
  label, make, model, year, vin, plate,
  weekly_rate, daily_rate, tier, active, fleet_vehicle_id, org_id, metadata
)
select
  coalesce(f.year::text || ' ', '') || btrim(f.vehicle_make) || ' ' || btrim(coalesce(f.vehicle_model,'')),
  btrim(f.vehicle_make),
  btrim(coalesce(f.vehicle_model,'')),
  nullif(regexp_replace(coalesce(f.year::text,''), '\D', '', 'g'), '')::smallint,
  f.vin,
  f.license_plate,
  (f.weekly_prices)[1]::numeric,
  round((f.weekly_prices)[1]::numeric / 7.0, 2),   -- same convention as the 2026-06-26 rows
  coalesce(o.tier, 'economy'::vehicle_tier),
  -- A Retired car is never active. Everything else stays listable; day-to-day
  -- availability is decided by fleet.vehicle_status at booking time, not here.
  coalesce(f.vehicle_status,'') is distinct from 'Retired',
  f.id,
  f.org_id,
  jsonb_build_object(
    'source', 'fleet_bridge',
    'bridged_at', now(),
    'bridge_run', '20260917000100',
    'posted_weekly_at_bridge', (f.weekly_prices)[1],
    'floor_weekly_at_bridge', f.lowest_possible_price
  )
from public.fleet f
left join tier_overrides o
  on lower(btrim(f.vehicle_make)) = lower(o.make)
 and (o.model is null or lower(btrim(coalesce(f.vehicle_model,''))) = lower(o.model))
where f.vehicle_make is not null
  and f.weekly_prices is not null
  and array_length(f.weekly_prices, 1) > 0
  and (f.weekly_prices)[1] ~ '^[0-9.]+$'
  and coalesce(f.vehicle_status,'') is distinct from 'Retired'
  and not exists (
    select 1 from public.vehicles v where v.fleet_vehicle_id = f.id
  );

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- DRY RUN ALREADY DONE: the SELECT half of this insert was executed read-only
-- against production on 2026-09-16. It returns exactly 26 rows; every label,
-- year cast, weekly/daily figure and tier assignment resolved correctly, and
-- every bridged weekly_rate is >= that car's own floor. Only the INSERT was
-- withheld.
--
-- VERIFY AFTER RUNNING (expect ~26 new rows, 28 total)
--   select count(*) from public.vehicles;
--   select tier, count(*), min(weekly_rate), max(weekly_rate)
--     from public.vehicles group by tier order by tier;
--
--   -- nothing bridged below its own floor:
--   select v.label, v.weekly_rate, f.lowest_possible_price
--     from public.vehicles v join public.fleet f on f.id = v.fleet_vehicle_id
--    where f.lowest_possible_price is not null
--      and v.weekly_rate < f.lowest_possible_price::numeric;   -- must be empty
--
-- ROLLBACK (this run only — leaves the 2026-06-26 rows alone)
--   delete from public.vehicles
--    where metadata->>'bridge_run' = '20260917000100';
-- ─────────────────────────────────────────────────────────────────────────────
