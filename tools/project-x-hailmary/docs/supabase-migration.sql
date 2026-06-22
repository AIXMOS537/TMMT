-- ============================================================
-- PROJECT X HAILMARY — WATCHTOWER LICENSE TABLE
-- Apply via: Supabase dashboard → SQL editor
-- Project: uapxakmlwnpfsftfeezx
-- ============================================================

CREATE TABLE IF NOT EXISTS hailmary_licenses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id          uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  operator_name       text NOT NULL,
  operator_email      text NOT NULL,
  operator_phone      text,
  operator_city       text,
  tier                text NOT NULL CHECK (tier IN ('taste', 'starter', 'operator', 'flagship')),
  device_fingerprint  text NOT NULL,
  activated_at        timestamptz NOT NULL DEFAULT now(),
  last_heartbeat      timestamptz,
  active              boolean NOT NULL DEFAULT true,
  paid_in_full        boolean NOT NULL DEFAULT false,
  revoked_at          timestamptz,
  revoke_reason       text,
  heartbeat_interval_days integer NOT NULL DEFAULT 7,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_hailmary_licenses_updated_at ON hailmary_licenses;
CREATE TRIGGER update_hailmary_licenses_updated_at
  BEFORE UPDATE ON hailmary_licenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: Only service role can read/write. No public access.
ALTER TABLE hailmary_licenses ENABLE ROW LEVEL SECURITY;

-- Deny all public/anon access
CREATE POLICY "no_public_access" ON hailmary_licenses
  FOR ALL TO public USING (false);

-- Watchtower view for PROJECT X HAILMARY's dashboard
CREATE OR REPLACE VIEW v_operator_watchtower AS
SELECT
  license_id,
  operator_name,
  operator_email,
  operator_city,
  tier,
  active,
  paid_in_full,
  activated_at,
  last_heartbeat,
  CASE
    WHEN last_heartbeat IS NULL THEN 'never_pinged'
    WHEN last_heartbeat < now() - INTERVAL '8 days' THEN 'overdue'
    WHEN last_heartbeat < now() - INTERVAL '14 days' THEN 'critical'
    ELSE 'healthy'
  END AS heartbeat_status,
  revoked_at,
  revoke_reason
FROM hailmary_licenses
ORDER BY activated_at DESC;
