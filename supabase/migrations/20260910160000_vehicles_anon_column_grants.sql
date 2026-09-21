-- anon may see the fleet, not its identity documents.
--
-- vehicles_anon_browse is a row policy: USING (active = true). Row policies choose
-- ROWS, never COLUMNS, so once the browse worked an anonymous request could ask for
-- any column on those rows -- and `?select=vin,plate` returned both:
--
--     vin  4T1BF1FK0HU671237     plate  6GJ4314
--     vin  JTJZB1BAXD2412561     plate  SXM3874
--
-- A VIN and a plate together identify a specific car to anyone who wants to clone the
-- plate, run the history, or find the vehicle. They are not marketing copy, and the
-- fleet browse never needed them.
--
-- Column-level grants are the only thing that fixes this; no policy can. anon keeps
-- SELECT on exactly what a listing shows and loses it everywhere else, including vin,
-- plate, metadata, fleet_vehicle_id and org_id. authenticated and service_role are
-- untouched -- staff still see the whole row.

revoke select on public.vehicles from anon;

grant select (
  id,
  label,
  make,
  model,
  year,
  tier,
  weekly_rate,
  daily_rate,
  active
) on public.vehicles to anon;
