-- TMMT workflow engine: cases, vendor jobs, intake, RLS
-- Set Supabase Auth app_metadata.role per user: admin | internal_team | va | investor | partner | vendor
-- Legacy: empty role = staff; partner = investor tier

-- ─── Role helpers (extend partner portal pattern) ───────────────────

CREATE OR REPLACE FUNCTION public.app_auth_role ()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nullif(trim(coalesce(auth.jwt () -> 'app_metadata' ->> 'role', '')), '');
$$;

CREATE OR REPLACE FUNCTION public.is_staff ()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    nullif(trim(coalesce(auth.jwt () -> 'app_metadata' ->> 'role', '')), ''),
    'admin'
  ) IN ('admin', 'va', 'internal_team');
$$;

CREATE OR REPLACE FUNCTION public.is_investor ()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT trim(coalesce(auth.jwt () -> 'app_metadata' ->> 'role', ''))
    IN ('investor', 'partner');
$$;

CREATE OR REPLACE FUNCTION public.is_vendor ()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT trim(coalesce(auth.jwt () -> 'app_metadata' ->> 'role', '')) = 'vendor';
$$;

CREATE OR REPLACE FUNCTION public.current_vendor_id ()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id
  FROM public.vendors v
  WHERE v.auth_user_id = auth.uid ()
    AND v.active = true
  LIMIT 1;
$$;

-- ─── Core tables ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  name text NOT NULL,
  org_type text DEFAULT 'internal',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  role text,
  organization_id uuid REFERENCES public.organizations (id) ON DELETE SET NULL,
  vendor_id uuid,
  investor_account_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  vendor_type text,
  auth_user_id uuid UNIQUE REFERENCES auth.users (id) ON DELETE SET NULL,
  shops_record_id uuid,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_vendor_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES public.vendors (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.investor_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  name text NOT NULL,
  auth_user_id uuid UNIQUE REFERENCES auth.users (id) ON DELETE SET NULL,
  contact_email text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_investor_account_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_investor_account_id_fkey
  FOREIGN KEY (investor_account_id) REFERENCES public.investor_accounts (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  case_number text NOT NULL UNIQUE,
  title text NOT NULL,
  request_type text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'intake_submitted',
  priority text,
  customer_name text,
  customer_phone text,
  customer_email text,
  intake_form_id uuid,
  assigned_vendor_id uuid REFERENCES public.vendors (id) ON DELETE SET NULL,
  clickup_task_id text,
  clickup_url text,
  airtable_record_id text,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_intake_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  case_id uuid REFERENCES public.cases (id) ON DELETE SET NULL,
  contact_name text NOT NULL,
  phone text,
  email text,
  request_type text NOT NULL DEFAULT 'rental_inquiry',
  description text,
  priority text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cases
  DROP CONSTRAINT IF EXISTS cases_intake_form_id_fkey;

ALTER TABLE public.cases
  ADD CONSTRAINT cases_intake_form_id_fkey
  FOREIGN KEY (intake_form_id) REFERENCES public.customer_intake_forms (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.case_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  case_id uuid NOT NULL REFERENCES public.cases (id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  case_id uuid REFERENCES public.cases (id) ON DELETE CASCADE,
  title text NOT NULL,
  assignee_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open',
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clickup_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  case_id uuid NOT NULL REFERENCES public.cases (id) ON DELETE CASCADE,
  clickup_task_id text NOT NULL,
  clickup_url text,
  list_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendor_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  case_id uuid NOT NULL REFERENCES public.cases (id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors (id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'offered',
  offered_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  scheduled_at timestamptz,
  completed_at timestamptz,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendor_job_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  vendor_job_id uuid NOT NULL REFERENCES public.vendor_jobs (id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendor_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  vendor_job_id uuid NOT NULL REFERENCES public.vendor_jobs (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.investor_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  investor_account_id uuid NOT NULL REFERENCES public.investor_accounts (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  published_at timestamptz NOT NULL DEFAULT now(),
  visible_to_investors boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  case_id uuid NOT NULL REFERENCES public.cases (id) ON DELETE CASCADE,
  approval_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  decided_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  case_id uuid REFERENCES public.cases (id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  case_id uuid REFERENCES public.cases (id) ON DELETE CASCADE,
  title text NOT NULL,
  storage_path text,
  doc_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cases_status_idx ON public.cases (status);

CREATE INDEX IF NOT EXISTS cases_created_at_idx ON public.cases (created_at DESC);

CREATE INDEX IF NOT EXISTS vendor_jobs_vendor_idx ON public.vendor_jobs (vendor_id);

CREATE INDEX IF NOT EXISTS vendor_jobs_case_idx ON public.vendor_jobs (case_id);

CREATE INDEX IF NOT EXISTS vendor_jobs_status_idx ON public.vendor_jobs (status);

-- ─── Case number + status history trigger ───────────────────────────

CREATE OR REPLACE FUNCTION public.next_case_number ()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  n bigint;
BEGIN
  SELECT count(*) + 1 INTO n FROM public.cases;
  RETURN 'TMMT-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.log_case_status_change ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.case_status_history (case_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid (), NULL);
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cases_status_history_trg ON public.cases;

CREATE TRIGGER cases_status_history_trg
  BEFORE UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.log_case_status_change ();

-- ─── Public intake RPC (anon + authenticated) ─────────────────────

CREATE OR REPLACE FUNCTION public.submit_customer_intake (
  p_contact_name text,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_request_type text DEFAULT 'rental_inquiry',
  p_description text DEFAULT NULL,
  p_priority text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_id uuid;
  v_intake_id uuid;
  v_case_number text;
  v_title text;
BEGIN
  IF length(trim(coalesce(p_contact_name, ''))) < 1 THEN
    RAISE EXCEPTION 'contact_name required';
  END IF;

  v_case_number := public.next_case_number ();
  v_title := trim(p_contact_name) || ' — ' || coalesce(nullif(trim(p_request_type), ''), 'inquiry');

  v_case_id := gen_random_uuid ();

  INSERT INTO public.cases (
    id,
    case_number,
    title,
    request_type,
    status,
    priority,
    customer_name,
    customer_phone,
    customer_email
  )
  VALUES (
    v_case_id,
    v_case_number,
    v_title,
    coalesce(nullif(trim(p_request_type), ''), 'general'),
    'intake_submitted',
    nullif(trim(p_priority), ''),
    trim(p_contact_name),
    nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''),
    nullif(trim(p_email), '')
  );

  INSERT INTO public.customer_intake_forms (
    case_id,
    contact_name,
    phone,
    email,
    request_type,
    description,
    priority
  )
  VALUES (
    v_case_id,
    trim(p_contact_name),
    nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''),
    nullif(trim(p_email), ''),
    coalesce(nullif(trim(p_request_type), ''), 'rental_inquiry'),
    nullif(trim(p_description), ''),
    nullif(trim(p_priority), '')
  )
  RETURNING id INTO v_intake_id;

  UPDATE public.cases
  SET intake_form_id = v_intake_id
  WHERE id = v_case_id;

  INSERT INTO public.case_status_history (case_id, from_status, to_status, note)
  VALUES (v_case_id, NULL, 'intake_submitted', 'Created from customer intake');

  INSERT INTO public.activity_logs (case_id, actor_id, action, details)
  VALUES (
    v_case_id,
    auth.uid (),
    'intake_submitted',
    jsonb_build_object('request_type', p_request_type)
  );

  RETURN v_case_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_customer_intake FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_customer_intake TO anon, authenticated;

-- ─── RLS ────────────────────────────────────────────────────────────

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_intake_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clickup_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_job_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Staff: full workflow access
CREATE POLICY "staff_all_organizations" ON public.organizations FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());
CREATE POLICY "staff_all_profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());
CREATE POLICY "staff_all_vendors_wf" ON public.vendors FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());
CREATE POLICY "staff_all_investor_accounts" ON public.investor_accounts FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());
CREATE POLICY "staff_all_cases" ON public.cases FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());
CREATE POLICY "staff_all_intake_forms" ON public.customer_intake_forms FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());
CREATE POLICY "staff_all_case_history" ON public.case_status_history FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());
CREATE POLICY "staff_all_tasks" ON public.tasks FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());
CREATE POLICY "staff_all_clickup_tasks" ON public.clickup_tasks FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());
CREATE POLICY "staff_all_vendor_jobs" ON public.vendor_jobs FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());
CREATE POLICY "staff_all_vendor_job_updates" ON public.vendor_job_updates FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());
CREATE POLICY "staff_all_vendor_files" ON public.vendor_files FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());
CREATE POLICY "staff_all_investor_updates" ON public.investor_updates FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());
CREATE POLICY "staff_all_approvals" ON public.approvals FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());
CREATE POLICY "staff_all_activity_logs" ON public.activity_logs FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());
CREATE POLICY "staff_all_documents" ON public.documents FOR ALL TO authenticated USING (public.is_staff ()) WITH CHECK (public.is_staff ());

-- Vendors: read own vendor row; manage own jobs
CREATE POLICY "vendor_read_self" ON public.vendors FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid () OR public.is_staff ());

CREATE POLICY "vendor_read_jobs" ON public.vendor_jobs FOR SELECT TO authenticated
  USING (vendor_id = public.current_vendor_id () OR public.is_staff ());

CREATE POLICY "vendor_update_jobs" ON public.vendor_jobs FOR UPDATE TO authenticated
  USING (vendor_id = public.current_vendor_id ())
  WITH CHECK (vendor_id = public.current_vendor_id ());

CREATE POLICY "vendor_insert_job_updates" ON public.vendor_job_updates FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendor_jobs j
      WHERE j.id = vendor_job_id AND j.vendor_id = public.current_vendor_id ()
    )
  );

CREATE POLICY "vendor_read_job_updates" ON public.vendor_job_updates FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendor_jobs j
      WHERE j.id = vendor_job_id AND j.vendor_id = public.current_vendor_id ()
    )
    OR public.is_staff ()
  );

CREATE POLICY "vendor_read_cases_for_jobs" ON public.cases FOR SELECT TO authenticated
  USING (
    public.is_staff ()
    OR EXISTS (
      SELECT 1 FROM public.vendor_jobs j
      WHERE j.case_id = cases.id AND j.vendor_id = public.current_vendor_id ()
    )
  );

CREATE POLICY "vendor_manage_files" ON public.vendor_files FOR ALL TO authenticated
  USING (
    public.is_staff ()
    OR EXISTS (
      SELECT 1 FROM public.vendor_jobs j
      WHERE j.id = vendor_job_id AND j.vendor_id = public.current_vendor_id ()
    )
  )
  WITH CHECK (
    public.is_staff ()
    OR EXISTS (
      SELECT 1 FROM public.vendor_jobs j
      WHERE j.id = vendor_job_id AND j.vendor_id = public.current_vendor_id ()
    )
  );

-- Investors: read published updates for linked account
CREATE POLICY "investor_read_updates" ON public.investor_updates FOR SELECT TO authenticated
  USING (
    public.is_staff ()
    OR (
      public.is_investor ()
      AND visible_to_investors = true
      AND investor_account_id IN (
        SELECT ia.id FROM public.investor_accounts ia WHERE ia.auth_user_id = auth.uid ()
      )
    )
  );

CREATE POLICY "investor_read_own_account" ON public.investor_accounts FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid () OR public.is_staff ());

-- Users read own notifications
CREATE POLICY "user_notifications" ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid () OR public.is_staff ())
  WITH CHECK (user_id = auth.uid () OR public.is_staff ());

-- Profiles: users read/update self
CREATE POLICY "profile_read_self" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid () OR public.is_staff ());

CREATE POLICY "profile_update_self" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid ())
  WITH CHECK (id = auth.uid ());

-- ─── Vendor file storage bucket ─────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-files', 'vendor-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "vendor_files_select" ON storage.objects;
CREATE POLICY "vendor_files_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'vendor-files'
    AND (public.is_staff () OR public.is_vendor ())
  );

DROP POLICY IF EXISTS "vendor_files_insert" ON storage.objects;
CREATE POLICY "vendor_files_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-files'
    AND (public.is_staff () OR public.is_vendor ())
  );

DROP POLICY IF EXISTS "vendor_files_delete" ON storage.objects;
CREATE POLICY "vendor_files_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'vendor-files'
    AND (public.is_staff () OR public.is_vendor ())
  );
