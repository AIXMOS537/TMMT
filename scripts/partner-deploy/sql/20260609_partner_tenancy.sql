-- Partner tenancy migration — Moe Legacy partner deploy v1
-- Apply with: psql "$SUPABASE_DB_URL" -f sql/20260609_partner_tenancy.sql
-- Idempotent: safe to re-run.
--
-- Per [[project_supabase_migration_drift]]: this file is local-repo state; verify against
-- production with `list_migrations` before applying. NEVER blindly replay.
--
-- Per [[feedback_revoke_from_public_not_anon]]: REVOKE FROM PUBLIC, not from anon —
-- anon inherits PUBLIC privileges, so revoking only from anon is a no-op.

BEGIN;

-- ============================================================================
-- 1. partner_tenants — registry of partner tenants
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.partner_tenants (
  tenant_id          text PRIMARY KEY,           -- 'moe-legacy', 'test-partner', etc.
  partner_name       text NOT NULL,
  partner_email      text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  challenge_phrase_hash text,                    -- sha256 of out-of-band recovery phrase
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','active','suspended','terminated'))
);

COMMENT ON TABLE public.partner_tenants IS
  'Partner tenant registry. tenant_id is scoped throughout overlay tables via RLS.';

-- ============================================================================
-- 2. partner_licenses — active/revoked state + kill_command field
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.partner_licenses (
  license_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          text NOT NULL REFERENCES public.partner_tenants(tenant_id) ON DELETE CASCADE,
  hardware_uuid      text,                       -- Apple Silicon HW UUID, set on first heartbeat
  enclave_pubkey     text,                       -- v1: openssl-generated ed25519 pubkey imported to the login
                                                 -- Keychain, set at install-token redemption. NOT an attestation
                                                 -- and NOT Secure-Enclave-generated. A populated value is
                                                 -- enrollment data only -- never evidence of hardware provenance,
                                                 -- authentication or authorization.
  active             boolean NOT NULL DEFAULT true,
  kill_command       text                        -- NULL | 'wipe' | 'legal_hold' | 'soft_disable'
                     CHECK (kill_command IS NULL OR kill_command IN ('wipe','legal_hold','soft_disable')),
  killed_at          timestamptz,
  killed_by          text,                       -- email of owner who triggered kill
  killed_reason      text,
  issued_at          timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz,                -- optional hard expiry
  last_heartbeat_at  timestamptz,
  UNIQUE (tenant_id, hardware_uuid)
);

COMMENT ON COLUMN public.partner_licenses.kill_command IS
  'Set by owner-side kill-partner.sh. Partner agent reads this on heartbeat; ' ||
  'if non-NULL, agent executes the directive and self-disables.';

-- ============================================================================
-- 3. partner_install_tokens — one-shot HMAC tokens for first-time provisioning
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.partner_install_tokens (
  token_hash         text PRIMARY KEY,           -- sha256 of the token bytes; raw token is on the USB
  tenant_id          text NOT NULL REFERENCES public.partner_tenants(tenant_id) ON DELETE CASCADE,
  issued_at          timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at            timestamptz,                -- set on first use; replay must fail
  used_by_hw_uuid    text,                       -- which hardware redeemed it
  used_from_ip       inet
);

CREATE INDEX IF NOT EXISTS partner_install_tokens_tenant
  ON public.partner_install_tokens(tenant_id);

-- ============================================================================
-- 4. partner_heartbeats — append-only heartbeat log
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.partner_heartbeats (
  heartbeat_id       bigserial PRIMARY KEY,
  tenant_id          text NOT NULL,
  hardware_uuid      text NOT NULL,
  received_at        timestamptz NOT NULL DEFAULT now(),
  app_version        text,
  action_counter     jsonb,                      -- {logins: N, intakes_submitted: N, ...}
  source_ip          inet
);

CREATE INDEX IF NOT EXISTS partner_heartbeats_tenant_time
  ON public.partner_heartbeats(tenant_id, received_at DESC);

-- ============================================================================
-- 5. partner_audit_events — append-only audit log (hourly ship from partner)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.partner_audit_events (
  event_id           bigserial PRIMARY KEY,
  tenant_id          text NOT NULL,
  hardware_uuid      text NOT NULL,
  event_ts           timestamptz NOT NULL,       -- partner-side timestamp from the audit.ndjson line
  received_at        timestamptz NOT NULL DEFAULT now(),
  event_type         text NOT NULL,              -- 'install','login','agent_call','data_export','credit_funding_session','lead_received','sms_sent','call_booked','payment_collected','consent_recorded','heartbeat'
  event_data         jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_ip          inet
);

CREATE INDEX IF NOT EXISTS partner_audit_tenant_time
  ON public.partner_audit_events(tenant_id, event_ts DESC);

CREATE INDEX IF NOT EXISTS partner_audit_event_type
  ON public.partner_audit_events(event_type, event_ts DESC);

-- ============================================================================
-- RLS — owner-protection-first
-- ============================================================================

ALTER TABLE public.partner_tenants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_licenses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_install_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_heartbeats      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_audit_events    ENABLE ROW LEVEL SECURITY;

-- DEFAULT DENY: revoke from PUBLIC (anon inherits), then grant narrowly below
REVOKE ALL ON public.partner_tenants         FROM PUBLIC;
REVOKE ALL ON public.partner_licenses        FROM PUBLIC;
REVOKE ALL ON public.partner_install_tokens  FROM PUBLIC;
REVOKE ALL ON public.partner_heartbeats      FROM PUBLIC;
REVOKE ALL ON public.partner_audit_events    FROM PUBLIC;

-- ---- partner_tenants: owner-only ----
DROP POLICY IF EXISTS partner_tenants_no_anon ON public.partner_tenants;
-- (no policy for anon = deny by default)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_tenants TO service_role;

-- ---- partner_licenses: owner-only ----
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_licenses TO service_role;
-- Partner's local agent reads license status via the public RPC `partner_license_status`
-- (below), which exposes only `(active, kill_command)` for the requesting tenant,
-- with NO ability to enumerate other tenants' licenses or read kill metadata.

-- ---- partner_install_tokens: owner-only ----
GRANT SELECT, INSERT, UPDATE ON public.partner_install_tokens TO service_role;
-- Partner's installer redeems via RPC `partner_redeem_install_token` (below).

-- ---- partner_heartbeats: INSERT-only for anon; SELECT for service_role ----
GRANT INSERT ON public.partner_heartbeats TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.partner_heartbeats_heartbeat_id_seq TO anon;
GRANT SELECT ON public.partner_heartbeats TO service_role;

DROP POLICY IF EXISTS heartbeats_anon_insert ON public.partner_heartbeats;
CREATE POLICY heartbeats_anon_insert ON public.partner_heartbeats
  FOR INSERT TO anon
  WITH CHECK (
    tenant_id IS NOT NULL
    AND hardware_uuid IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.partner_tenants t
      WHERE t.tenant_id = partner_heartbeats.tenant_id
        AND t.status IN ('active','pending')
    )
  );

DROP POLICY IF EXISTS heartbeats_service_select ON public.partner_heartbeats;
CREATE POLICY heartbeats_service_select ON public.partner_heartbeats
  FOR SELECT TO service_role USING (true);

-- ---- partner_audit_events: INSERT-only for anon; SELECT for service_role ----
GRANT INSERT ON public.partner_audit_events TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.partner_audit_events_event_id_seq TO anon;
GRANT SELECT ON public.partner_audit_events TO service_role;

DROP POLICY IF EXISTS audit_anon_insert ON public.partner_audit_events;
CREATE POLICY audit_anon_insert ON public.partner_audit_events
  FOR INSERT TO anon
  WITH CHECK (
    tenant_id IS NOT NULL
    AND hardware_uuid IS NOT NULL
    AND event_type IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.partner_tenants t
      WHERE t.tenant_id = partner_audit_events.tenant_id
        AND t.status IN ('active','pending')
    )
  );

DROP POLICY IF EXISTS audit_service_select ON public.partner_audit_events;
CREATE POLICY audit_service_select ON public.partner_audit_events
  FOR SELECT TO service_role USING (true);

-- ============================================================================
-- RPCs (SECURITY DEFINER) — narrow surface for partner-side agent
-- ============================================================================

-- partner_license_status: returns only (active, kill_command, killed_at) for the
-- requesting tenant. SECURITY DEFINER so it can read partner_licenses without
-- granting partner anon access to the table itself.
CREATE OR REPLACE FUNCTION public.partner_license_status(
  p_tenant_id    text,
  p_hardware_uuid text
)
RETURNS TABLE (
  active        boolean,
  kill_command  text,
  killed_at     timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT l.active, l.kill_command, l.killed_at
  FROM partner_licenses l
  WHERE l.tenant_id = p_tenant_id
    AND (l.hardware_uuid IS NULL OR l.hardware_uuid = p_hardware_uuid)
  ORDER BY l.issued_at DESC
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.partner_license_status(text,text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.partner_license_status(text,text) TO anon;

-- partner_redeem_install_token: one-shot redemption. Sets used_at, used_by_hw_uuid.
-- Idempotent: second call with the same token returns 'already_used'.
CREATE OR REPLACE FUNCTION public.partner_redeem_install_token(
  p_token_hash       text,
  p_hardware_uuid    text,
  p_enclave_pubkey   text,
  p_source_ip        text
)
RETURNS TABLE (
  result_code   text,                  -- 'ok' | 'expired' | 'already_used' | 'unknown'
  tenant_id     text,
  license_id    uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_token   public.partner_install_tokens%ROWTYPE;
  v_license uuid;
BEGIN
  SELECT * INTO v_token
  FROM partner_install_tokens
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'unknown'::text, NULL::text, NULL::uuid;
    RETURN;
  END IF;

  IF v_token.used_at IS NOT NULL THEN
    RETURN QUERY SELECT 'already_used'::text, v_token.tenant_id, NULL::uuid;
    RETURN;
  END IF;

  IF v_token.expires_at < now() THEN
    RETURN QUERY SELECT 'expired'::text, v_token.tenant_id, NULL::uuid;
    RETURN;
  END IF;

  -- Mark token consumed
  UPDATE partner_install_tokens
  SET used_at = now(),
      used_by_hw_uuid = p_hardware_uuid,
      used_from_ip = p_source_ip::inet
  WHERE token_hash = p_token_hash;

  -- Bind license to hardware
  UPDATE partner_licenses
  SET hardware_uuid = p_hardware_uuid,
      enclave_pubkey = p_enclave_pubkey
  WHERE tenant_id = v_token.tenant_id
    AND hardware_uuid IS NULL
  RETURNING license_id INTO v_license;

  -- Activate tenant
  UPDATE partner_tenants
  SET status = 'active'
  WHERE tenant_id = v_token.tenant_id;

  -- Record install in audit
  INSERT INTO partner_audit_events (tenant_id, hardware_uuid, event_ts, event_type, event_data, source_ip)
  VALUES (v_token.tenant_id, p_hardware_uuid, now(), 'install',
          jsonb_build_object('license_id', v_license, 'enclave_pubkey', p_enclave_pubkey),
          p_source_ip::inet);

  RETURN QUERY SELECT 'ok'::text, v_token.tenant_id, v_license;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.partner_redeem_install_token(text,text,text,text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.partner_redeem_install_token(text,text,text,text) TO anon;

-- ============================================================================
-- Convenience view for owner-side kill switch UI
-- ============================================================================

CREATE OR REPLACE VIEW public.partner_status_overview AS
SELECT t.tenant_id,
       t.partner_name,
       t.status                                AS tenant_status,
       l.active                                AS license_active,
       l.kill_command,
       l.hardware_uuid,
       l.last_heartbeat_at,
       CASE
         WHEN l.last_heartbeat_at IS NULL THEN NULL
         WHEN l.last_heartbeat_at < now() - interval '72 hours' THEN 'STALE'
         WHEN l.last_heartbeat_at < now() - interval '24 hours' THEN 'WARN'
         ELSE 'OK'
       END                                     AS heartbeat_status
FROM partner_tenants t
LEFT JOIN LATERAL (
  SELECT * FROM partner_licenses
  WHERE tenant_id = t.tenant_id
  ORDER BY issued_at DESC LIMIT 1
) l ON true;

REVOKE ALL ON public.partner_status_overview FROM PUBLIC;
GRANT  SELECT ON public.partner_status_overview TO service_role;

COMMIT;
