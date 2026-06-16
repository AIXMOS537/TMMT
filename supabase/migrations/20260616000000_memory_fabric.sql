-- Memory Fabric — Phase 0: schema + activity_logs backfill bridge
-- Spec:  docs/superpowers/specs/2026-06-16-memory-fabric-design.md
-- Plan:  docs/superpowers/plans/2026-06-16-memory-fabric.md
--
-- Org-wide, self-maintaining memory layer (Capture -> Store -> Recall).
-- Extends the narrow public.activity_logs (auth-user + case only) into a
-- polymorphic store that can hold EVERY actor: AI agents, operators, team,
-- owners, and outside parties (customers, vendors, a lawyer texting in).
--
-- Reuses existing helpers: public.is_staff(), public.is_owner().
-- Service-role writes (ingestors / external parties) bypass RLS by design.

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- 1. memory_entities — the stable nouns the business cares about
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.memory_entities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  kind          text NOT NULL DEFAULT 'other'
                  CHECK (kind IN ('person', 'vehicle', 'deal', 'vendor', 'org', 'other')),
  display_name  text NOT NULL,
  org_id        uuid REFERENCES public.organizations (id) ON DELETE SET NULL,
  external_refs jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { clickup_id, airtable_id, phone, email, fleet_id, ... }
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_entities_org_idx ON public.memory_entities (org_id);
CREATE INDEX IF NOT EXISTS memory_entities_kind_idx ON public.memory_entities (kind);
CREATE INDEX IF NOT EXISTS memory_entities_refs_idx ON public.memory_entities USING gin (external_refs);

-- ---------------------------------------------------------------------------
-- 2. memory_events — raw, append-only, polymorphic-actor timeline
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.memory_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  org_id      uuid REFERENCES public.organizations (id) ON DELETE SET NULL,
  actor_kind  text NOT NULL
                CHECK (actor_kind IN ('ai_agent', 'operator', 'team', 'owner', 'external', 'system')),
  actor_id    uuid REFERENCES auth.users (id) ON DELETE SET NULL,  -- null for agents/external
  actor_label text,                                                -- 'CAPTAIN agent', 'John Lopez (lawyer)'
  source      text NOT NULL DEFAULT 'app'
                CHECK (source IN ('app', 'slack', 'clickup', 'gmail', 'quo', 'calendar', 'airtable', 'agent', 'system')),
  action      text NOT NULL,                                       -- verb: 'sent_sms', 'created_task', 'approved'
  entity_id   uuid REFERENCES public.memory_entities (id) ON DELETE SET NULL,
  summary     text,                                               -- one-line human-readable
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding   vector(1536),                                        -- pgvector, for semantic recall
  dedupe_key  text UNIQUE,                                        -- 'quo:msg:<id>' etc. — idempotent re-ingest
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_events_org_time_idx ON public.memory_events (org_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS memory_events_entity_idx ON public.memory_events (entity_id);
CREATE INDEX IF NOT EXISTS memory_events_actor_idx ON public.memory_events (actor_kind, actor_id);
CREATE INDEX IF NOT EXISTS memory_events_source_idx ON public.memory_events (source);
-- Semantic recall index (cosine). Tune `lists` once the table is populated.
CREATE INDEX IF NOT EXISTS memory_events_embedding_idx
  ON public.memory_events USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ---------------------------------------------------------------------------
-- 3. memory_facts — distilled, durable, temporal knowledge
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.memory_facts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  org_id       uuid REFERENCES public.organizations (id) ON DELETE SET NULL,
  entity_id    uuid REFERENCES public.memory_entities (id) ON DELETE SET NULL,
  fact         text NOT NULL,                                      -- 'Prefers SMS to the 571 number'
  confidence   real NOT NULL DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
  visibility   text NOT NULL DEFAULT 'org' CHECK (visibility IN ('org', 'owner')),
  source_event uuid REFERENCES public.memory_events (id) ON DELETE SET NULL,
  embedding    vector(1536),
  valid_from   timestamptz NOT NULL DEFAULT now(),
  valid_to     timestamptz,                                        -- null = still true; supersede, never delete
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_facts_org_idx ON public.memory_facts (org_id);
CREATE INDEX IF NOT EXISTS memory_facts_entity_idx ON public.memory_facts (entity_id);
CREATE INDEX IF NOT EXISTS memory_facts_active_idx ON public.memory_facts (entity_id) WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS memory_facts_embedding_idx
  ON public.memory_facts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ---------------------------------------------------------------------------
-- 4. Row-Level Security
--    Mirrors the existing staff_all_* pattern (see 20260516120000_workflow_engine.sql).
--    Service role bypasses RLS, so ingestors and external-party writes work
--    without an explicit anon policy.
-- ---------------------------------------------------------------------------

-- is_owner(): owner = profiles.role 'admin' (consistent with is_staff() and
-- auth-roles.ts isOwnerUser). Created here because some environments predate it.
CREATE OR REPLACE FUNCTION public.is_owner ()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce((
    SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid ()
  ), false) OR coalesce(public.app_auth_role () = 'admin', false);
$function$;
ALTER TABLE public.memory_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_facts ENABLE ROW LEVEL SECURITY;

-- Entities & events: any staff member may read/write within the app.
CREATE POLICY "staff_all_memory_entities" ON public.memory_entities
  FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

CREATE POLICY "staff_all_memory_events" ON public.memory_events
  FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- Facts: org-visible facts to all staff; owner-only facts restricted to owners.
CREATE POLICY "staff_read_org_memory_facts" ON public.memory_facts
  FOR SELECT TO authenticated
  USING (public.is_staff () AND (visibility = 'org' OR public.is_owner ()));

CREATE POLICY "staff_write_memory_facts" ON public.memory_facts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff () AND (visibility = 'org' OR public.is_owner ()));

CREATE POLICY "staff_update_memory_facts" ON public.memory_facts
  FOR UPDATE TO authenticated
  USING (public.is_staff () AND (visibility = 'org' OR public.is_owner ()))
  WITH CHECK (public.is_staff () AND (visibility = 'org' OR public.is_owner ()));

-- ---------------------------------------------------------------------------
-- 5. updated_at trigger for entities
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_memory_entity_updated_at ()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_memory_entities_updated_at ON public.memory_entities;
CREATE TRIGGER trg_memory_entities_updated_at
  BEFORE UPDATE ON public.memory_entities
  FOR EACH ROW EXECUTE FUNCTION public.touch_memory_entity_updated_at ();

-- ---------------------------------------------------------------------------
-- 6. Bridge: backfill existing audit trails into memory_events
--    Both backfills are GUARDED — they run only if the source table exists, so
--    this migration applies cleanly across environments with differing history.
--    Idempotent via dedupe_key.
-- ---------------------------------------------------------------------------

-- 6a. activity_logs (present in environments where the workflow-engine migration
--     has been applied; mapped via profiles.role).
DO $$
BEGIN
  IF to_regclass('public.activity_logs') IS NOT NULL THEN
    INSERT INTO public.memory_events
      (org_id, actor_kind, actor_id, actor_label, source, action, summary, details, occurred_at, created_at, dedupe_key)
    SELECT
      p.organization_id,
      CASE
        WHEN p.role = 'admin' THEN 'owner'
        WHEN p.role IN ('internal_team', 'operator', 'executive_va', 'team', 'staff') THEN 'operator'
        WHEN al.actor_id IS NULL THEN 'system'
        ELSE 'operator'
      END,
      al.actor_id,
      COALESCE(p.full_name, p.email),
      'app',
      al.action,
      left(coalesce(al.action, 'activity'), 200),
      coalesce(al.details, '{}'::jsonb) || jsonb_build_object('case_id', al.case_id),
      al.created_at,
      al.created_at,
      'activity_logs:' || al.id::text
    FROM public.activity_logs al
    LEFT JOIN public.profiles p ON p.id = al.actor_id
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
END $$;

-- 6b. audit_events (general-purpose append-only audit; system-attributed).
DO $$
BEGIN
  IF to_regclass('public.audit_events') IS NOT NULL THEN
    INSERT INTO public.memory_events
      (org_id, actor_kind, actor_id, actor_label, source, action, summary, details, occurred_at, created_at, dedupe_key)
    SELECT
      ae.organization_id,
      'system',
      NULL,
      'audit',
      'system',
      coalesce(ae.action, 'audit_event'),
      left(coalesce(ae.action, 'audit_event'), 200),
      coalesce(ae.payload, '{}'::jsonb)
        || jsonb_build_object('hardware_uuid', ae.hardware_uuid, 'ip', ae.ip::text),
      ae.ts,
      ae.ts,
      'audit_events:' || ae.id::text
    FROM public.audit_events ae
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Documentation comments
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.memory_entities IS 'Memory Fabric: stable business nouns (people, vehicles, deals) events/facts attach to.';
COMMENT ON TABLE public.memory_events   IS 'Memory Fabric: append-only, polymorphic-actor activity timeline across the board.';
COMMENT ON TABLE public.memory_facts    IS 'Memory Fabric: distilled, temporal knowledge. Supersede via valid_to; never destructive-delete.';
COMMENT ON COLUMN public.memory_events.actor_kind IS 'ai_agent | operator | team | owner | external | system — enables capturing non-auth actors.';
COMMENT ON COLUMN public.memory_events.dedupe_key IS 'Idempotency key for re-ingestion, e.g. quo:msg:<id>, clickup:<id>:<ts>.';
