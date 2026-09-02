-- Align workflow intake + vendor tables with production ops-routing cases schema
-- (ref_code, subject, clickup_task_url — not case_number/title/clickup_url)

CREATE OR REPLACE FUNCTION public.next_ref_code ()
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
  v_ref_code text;
  v_subject text;
BEGIN
  IF length(trim(coalesce(p_contact_name, ''))) < 1 THEN
    RAISE EXCEPTION 'contact_name required';
  END IF;

  v_ref_code := public.next_ref_code ();
  v_subject := trim(p_contact_name) || ' — ' || coalesce(nullif(trim(p_request_type), ''), 'inquiry');
  v_case_id := gen_random_uuid ();

  INSERT INTO public.customer_intake_forms (
    customer_name,
    customer_email,
    customer_phone,
    request_type,
    subject,
    details,
    source,
    payload
  )
  VALUES (
    trim(p_contact_name),
    nullif(trim(p_email), ''),
    nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''),
    coalesce(nullif(trim(p_request_type), ''), 'general'),
    v_subject,
    nullif(trim(p_description), ''),
    'web',
    jsonb_build_object('priority', nullif(trim(p_priority), ''))
  )
  RETURNING id INTO v_intake_id;

  INSERT INTO public.cases (
    id,
    ref_code,
    intake_id,
    customer_name,
    customer_email,
    customer_phone,
    request_type,
    subject,
    description,
    status,
    routing_status,
    metadata
  )
  VALUES (
    v_case_id,
    v_ref_code,
    v_intake_id,
    trim(p_contact_name),
    nullif(trim(p_email), ''),
    nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''),
    coalesce(nullif(trim(p_request_type), ''), 'general'),
    v_subject,
    nullif(trim(p_description), ''),
    'intake_submitted',
    'pending',
    jsonb_build_object('priority', nullif(trim(p_priority), ''))
  );

  INSERT INTO public.case_status_history (case_id, from_status, to_status, note)
  VALUES (v_case_id, NULL, 'intake_submitted', 'Created from customer intake');

  RETURN v_case_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_customer_intake FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_customer_intake TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.clickup_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  case_id uuid REFERENCES public.cases (id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS vendor_jobs_vendor_idx ON public.vendor_jobs (vendor_id);
CREATE INDEX IF NOT EXISTS vendor_jobs_case_idx ON public.vendor_jobs (case_id);
CREATE INDEX IF NOT EXISTS vendor_jobs_status_idx ON public.vendor_jobs (status);

ALTER TABLE public.clickup_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_job_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_files ENABLE ROW LEVEL SECURITY;
