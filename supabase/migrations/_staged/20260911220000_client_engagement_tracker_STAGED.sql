-- =============================================================================
-- Client engagement tracker (G4) — STAGED, NOT APPLIED.
--
-- Applying this is OWNER-GATED. Do not run `supabase db push`: the 49 migration
-- files in this repo do not match the 240 rows in the remote ledger, so a push
-- would try to replay history that is already live. When this is applied it
-- should be applied alone, by hand, against a known-good backup.
--
-- What it adds: the two tables behind the client-facing build tracker at
-- /pocket/build, and the row-level security that makes "a client sees only
-- their own org" true in the DATABASE rather than only in the query.
--
-- The security model, stated plainly:
--   Both tables are org-scoped by `organization_id`, matched against the
--   caller's own `profiles.organization_id`. A client authenticated as org B
--   cannot SELECT org A's rows even with a hand-written query, because the
--   policy filters before the app ever sees a row. The app-side half of this
--   guarantee is that the tracker page uses the SSR (RLS-respecting) client and
--   never the service-role client — service-role BYPASSES RLS entirely and would
--   silently undo everything below. `engagement-rls.test.ts` asserts both halves.
--
-- UUIDs, deliberately: P0-1 (tenant ids stored as text slugs where the DB wants
-- uuid) is still open elsewhere in this codebase. Nothing here widens it —
-- `organization_id` is a real `uuid` with a real foreign key, which is the shape
-- the rest of the schema already uses (`profiles.organization_id`).
-- =============================================================================

-- ── the engagement itself ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_engagements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,

  -- client-visible phase. Mirrors ENGAGEMENT_PHASES in src/lib/workflow/statuses.ts.
  phase            text NOT NULL DEFAULT 'intake'
                     CHECK (phase IN ('intake', 'agreement', 'build', 'live')),

  -- read-only dossier captured at intake. Client sees it; client cannot edit it.
  intake_summary   jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- what is actually running for this client. Array of short plain-English lines.
  whats_live       text[] NOT NULL DEFAULT '{}',

  -- phase timestamps. NULL means "not reached yet" — that is what the tracker
  -- renders as an empty step, and it is why these are nullable rather than
  -- defaulted. intake_at is set when the row is created.
  intake_at        timestamptz NOT NULL DEFAULT now(),
  agreement_at     timestamptz,
  build_at         timestamptz,
  live_at          timestamptz,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- One live engagement per org keeps the tracker unambiguous — the page reads
-- "the" engagement, not "an" engagement.
CREATE UNIQUE INDEX IF NOT EXISTS client_engagements_one_per_org
  ON public.client_engagements (organization_id);

-- ── the change-request thread ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.engagement_change_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id    uuid NOT NULL REFERENCES public.client_engagements (id) ON DELETE CASCADE,

  -- Denormalised from the parent on purpose. The RLS policy can then filter on
  -- this table alone, with no join and no recursive policy evaluation against
  -- client_engagements. The trigger below keeps it honest so it cannot drift.
  organization_id  uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,

  author_id        uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  author_kind      text NOT NULL CHECK (author_kind IN ('client', 'operator')),
  body             text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS engagement_change_requests_thread
  ON public.engagement_change_requests (engagement_id, created_at);

-- A client could otherwise INSERT a row naming their OWN org while pointing
-- engagement_id at ANOTHER org's engagement — the WITH CHECK below would pass
-- (their org matches) and the row would land in a stranger's thread. This
-- forces organization_id to come from the parent engagement, never the caller.
CREATE OR REPLACE FUNCTION public.engagement_change_request_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT e.organization_id INTO NEW.organization_id
  FROM public.client_engagements e
  WHERE e.id = NEW.engagement_id;

  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'engagement % does not exist', NEW.engagement_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS engagement_change_request_org_trg ON public.engagement_change_requests;
CREATE TRIGGER engagement_change_request_org_trg
  BEFORE INSERT ON public.engagement_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.engagement_change_request_org();

-- ── row level security ───────────────────────────────────────────────────────
ALTER TABLE public.client_engagements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_change_requests ENABLE ROW LEVEL SECURITY;

-- Deny by default: no policy for anon at all, so anon reads nothing.
REVOKE ALL ON public.client_engagements        FROM anon;
REVOKE ALL ON public.engagement_change_requests FROM anon;

-- A client reads only their own org's engagement.
DROP POLICY IF EXISTS client_engagements_own_org_select ON public.client_engagements;
CREATE POLICY client_engagements_own_org_select
  ON public.client_engagements
  FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- A client reads only their own org's thread.
DROP POLICY IF EXISTS engagement_change_requests_own_org_select ON public.engagement_change_requests;
CREATE POLICY engagement_change_requests_own_org_select
  ON public.engagement_change_requests
  FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- A client may post to their own org's thread, and only as 'client'.
-- author_id must be themselves, so one client cannot post as another.
DROP POLICY IF EXISTS engagement_change_requests_own_org_insert ON public.engagement_change_requests;
CREATE POLICY engagement_change_requests_own_org_insert
  ON public.engagement_change_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND author_kind = 'client'
    AND author_id = auth.uid()
  );

-- No UPDATE and no DELETE policy for `authenticated`, deliberately. The thread is
-- append-only from the client's side: they cannot edit or erase what they asked
-- for, and neither can they erase an operator's reply. Operators reply from the
-- admin surface, which runs service-role.

COMMENT ON TABLE public.client_engagements IS
  'Client-facing build tracker. RLS: a client sees only their own org. Operator writes go through service-role from the admin surface.';
COMMENT ON TABLE public.engagement_change_requests IS
  'Append-only change-request thread. Client INSERT is restricted to their own org, as themselves, as author_kind=client.';
