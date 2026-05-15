-- Expose license plate and VIN to partners via get_partner_fleet() (linked vehicles only).

DROP FUNCTION IF EXISTS public.get_partner_fleet ();

CREATE OR REPLACE FUNCTION public.get_partner_fleet ()
RETURNS TABLE (
  fleet_id uuid,
  vehicle_name text,
  vehicle_make text,
  vehicle_model text,
  year integer,
  vehicle_status text,
  color text,
  partner_percentage numeric,
  partner_portal_notes text,
  last_updated_at timestamptz,
  license_plate text,
  vin_number text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.vehicle_name,
    f.vehicle_make,
    f.vehicle_model,
    f.year,
    f.vehicle_status,
    f.color,
    f.partner_percentage,
    f.partner_portal_notes,
    coalesce(f.updated_at, f.created_at),
    f.license_plate,
    f.vin AS vin_number
  FROM public.fleet f
  INNER JOIN public.partner_fleet_access pfa
    ON pfa.fleet_id = f.id
   AND pfa.partner_user_id = auth.uid ()
  WHERE public.is_partner ();
$$;

REVOKE ALL ON FUNCTION public.get_partner_fleet () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_partner_fleet () TO authenticated;
