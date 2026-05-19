-- Ops command center: owner → executive VAs → operators with AI review gate

CREATE TABLE IF NOT EXISTS public.company_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  body text NOT NULL,
  version int NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ops_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  title text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ops_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  thread_id uuid NOT NULL REFERENCES public.ops_threads (id) ON DELETE CASCADE,
  parent_message_id uuid REFERENCES public.ops_messages (id) ON DELETE SET NULL,
  author_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL,
  raw_transcript text,
  audience text NOT NULL DEFAULT 'executives',
  message_kind text NOT NULL DEFAULT 'command',
  status text NOT NULL DEFAULT 'draft',
  ai_aligned boolean,
  ai_score numeric,
  ai_issues jsonb DEFAULT '[]'::jsonb,
  ai_suggested_body text,
  ai_reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ops_messages_audience_check CHECK (audience IN ('executives', 'operators', 'owner_only')),
  CONSTRAINT ops_messages_kind_check CHECK (message_kind IN ('command', 'relay', 'note', 'assistant_draft')),
  CONSTRAINT ops_messages_status_check CHECK (
    status IN ('draft', 'ai_review', 'needs_edit', 'approved', 'published', 'rejected')
  )
);

CREATE INDEX IF NOT EXISTS ops_messages_thread_idx ON public.ops_messages (thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ops_messages_audience_status_idx ON public.ops_messages (audience, status);

-- Role helpers for ops layer
CREATE OR REPLACE FUNCTION public.is_owner ()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT trim(coalesce(auth.jwt () -> 'app_metadata' ->> 'role', '')) = 'admin'::text;
$$;

CREATE OR REPLACE FUNCTION public.is_executive_va ()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT trim(coalesce(auth.jwt () -> 'app_metadata' ->> 'role', ''))
    IN ('executive_va', 'executive');
$$;

CREATE OR REPLACE FUNCTION public.is_operator ()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT trim(coalesce(auth.jwt () -> 'app_metadata' ->> 'role', '')) = 'operator'::text;
$$;

CREATE OR REPLACE FUNCTION public.is_ops_staff ()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_owner ()
    OR public.is_executive_va ()
    OR public.is_operator ()
    OR public.is_staff ();
$$;

ALTER TABLE public.company_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ops_staff_read_policies"
  ON public.company_policies FOR SELECT TO authenticated
  USING (public.is_ops_staff () AND active = true);

CREATE POLICY "owner_manage_policies"
  ON public.company_policies FOR ALL TO authenticated
  USING (public.is_owner ())
  WITH CHECK (public.is_owner ());

CREATE POLICY "ops_threads_select"
  ON public.ops_threads FOR SELECT TO authenticated
  USING (public.is_ops_staff ());

CREATE POLICY "ops_threads_insert"
  ON public.ops_threads FOR INSERT TO authenticated
  WITH CHECK (public.is_owner () OR public.is_executive_va ());

CREATE POLICY "ops_threads_update_owner_exec"
  ON public.ops_threads FOR UPDATE TO authenticated
  USING (public.is_owner () OR public.is_executive_va ())
  WITH CHECK (public.is_owner () OR public.is_executive_va ());

CREATE POLICY "ops_messages_select"
  ON public.ops_messages FOR SELECT TO authenticated
  USING (
    public.is_owner ()
    OR public.is_executive_va ()
    OR (
      public.is_operator ()
      AND audience = 'operators'
      AND status = 'published'
    )
    OR (
      public.is_staff ()
      AND status IN ('approved', 'published')
    )
  );

CREATE POLICY "ops_messages_insert"
  ON public.ops_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid ()
    AND (
      public.is_owner ()
      OR public.is_executive_va ()
    )
  );

CREATE POLICY "ops_messages_update_author_or_owner"
  ON public.ops_messages FOR UPDATE TO authenticated
  USING (author_id = auth.uid () OR public.is_owner ())
  WITH CHECK (author_id = auth.uid () OR public.is_owner ());

-- Seed policy placeholder (replace body via app or SQL after deploy)
INSERT INTO public.company_policies (slug, title, body)
VALUES (
  'default',
  'TMMT / AIXMOS default policy',
  'See docs/ops-company-policy.md in the repository for the full policy text. Run the app seed or update this row in Supabase.'
)
ON CONFLICT (slug) DO NOTHING;
