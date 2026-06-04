-- Contract PDF + driver license storage paths, public upload tokens, and staff Storage RLS.
-- Requires public.is_staff() from partner portal migration (20260503120000_partner_portal_rls.sql).

-- ─── Tables: new columns ─────────────────────────────────────────────

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS contract_pdf_storage_path text,
  ADD COLUMN IF NOT EXISTS contract_pdf_uploaded_at timestamptz;

ALTER TABLE public.background_checks
  ADD COLUMN IF NOT EXISTS drivers_license_front_path text,
  ADD COLUMN IF NOT EXISTS drivers_license_back_path text,
  ADD COLUMN IF NOT EXISTS license_upload_token uuid,
  ADD COLUMN IF NOT EXISTS license_upload_token_expires_at timestamptz;

ALTER TABLE public.active_customers
  ADD COLUMN IF NOT EXISTS drivers_license_front_path text,
  ADD COLUMN IF NOT EXISTS drivers_license_back_path text,
  ADD COLUMN IF NOT EXISTS license_upload_token uuid,
  ADD COLUMN IF NOT EXISTS license_upload_token_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS background_checks_license_upload_token_key
  ON public.background_checks (license_upload_token)
  WHERE license_upload_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS active_customers_license_upload_token_key
  ON public.active_customers (license_upload_token)
  WHERE license_upload_token IS NOT NULL;

-- ─── Storage bucket (idempotent; tighten limits in Dashboard if needed) ─

INSERT INTO storage.buckets (id, name, public)
VALUES ('staff-documents', 'staff-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ─── storage.objects policies: staff JWT only ─────────────────────────

DROP POLICY IF EXISTS "staff_documents_select" ON storage.objects;
CREATE POLICY "staff_documents_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'staff-documents'
    AND public.is_staff ()
  );

DROP POLICY IF EXISTS "staff_documents_insert" ON storage.objects;
CREATE POLICY "staff_documents_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'staff-documents'
    AND public.is_staff ()
  );

DROP POLICY IF EXISTS "staff_documents_update" ON storage.objects;
CREATE POLICY "staff_documents_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'staff-documents'
    AND public.is_staff ()
  )
  WITH CHECK (
    bucket_id = 'staff-documents'
    AND public.is_staff ()
  );

DROP POLICY IF EXISTS "staff_documents_delete" ON storage.objects;
CREATE POLICY "staff_documents_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'staff-documents'
    AND public.is_staff ()
  );
