-- Fix the vendor portal: it reads vendor_jobs/updates/files via the authenticated
-- client with no filter, expecting RLS to scope to the vendor — but no policies
-- existed (RLS on + 0 policies = deny-all, so a vendor saw nothing). Add: staff
-- see all; a vendor sees only their own (vendors.auth_user_id = auth.uid()).
-- Writes go through the service role (workflow-actions), so SELECT for vendors
-- is enough. Applied to production 2026-06-09.

DROP POLICY IF EXISTS staff_all_vendor_jobs ON public.vendor_jobs;
CREATE POLICY staff_all_vendor_jobs ON public.vendor_jobs
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS vendor_select_own_jobs ON public.vendor_jobs;
CREATE POLICY vendor_select_own_jobs ON public.vendor_jobs
  FOR SELECT TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS staff_all_vendor_job_updates ON public.vendor_job_updates;
CREATE POLICY staff_all_vendor_job_updates ON public.vendor_job_updates
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS vendor_select_own_job_updates ON public.vendor_job_updates;
CREATE POLICY vendor_select_own_job_updates ON public.vendor_job_updates
  FOR SELECT TO authenticated
  USING (vendor_job_id IN (
    SELECT vj.id FROM public.vendor_jobs vj
    JOIN public.vendors v ON v.id = vj.vendor_id
    WHERE v.auth_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS staff_all_vendor_files ON public.vendor_files;
CREATE POLICY staff_all_vendor_files ON public.vendor_files
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS vendor_select_own_files ON public.vendor_files;
CREATE POLICY vendor_select_own_files ON public.vendor_files
  FOR SELECT TO authenticated
  USING (vendor_job_id IN (
    SELECT vj.id FROM public.vendor_jobs vj
    JOIN public.vendors v ON v.id = vj.vendor_id
    WHERE v.auth_user_id = auth.uid()
  ));
