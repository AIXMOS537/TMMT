-- Org-scoped read isolation — clears the gating item for external client logins.
--
-- ADDITIVE: the existing provider staff_all_* policies remain (provider sees
-- all). These add per-org READ access so a client org's members (via org_roles /
-- is_org_member) see ONLY their own org's rows. Writes still go through the
-- provider/service-role server paths.
--
-- cases is intentionally NOT touched — it already has client-scoped policies
-- (cases_client_email_read / cases_internal_*).

CREATE POLICY "org_read_memory_entities" ON public.memory_entities
  FOR SELECT TO authenticated USING (public.is_org_member (org_id));

CREATE POLICY "org_read_memory_events" ON public.memory_events
  FOR SELECT TO authenticated USING (public.is_org_member (org_id));

CREATE POLICY "org_read_memory_facts" ON public.memory_facts
  FOR SELECT TO authenticated USING (public.is_org_member (org_id) AND visibility = 'org');

CREATE POLICY "org_read_routing_candidates" ON public.routing_candidates
  FOR SELECT TO authenticated USING (public.is_org_member (org_id));

CREATE POLICY "org_read_customer_services" ON public.customer_services
  FOR SELECT TO authenticated USING (public.is_org_member (org_id));

CREATE POLICY "org_read_verticals" ON public.verticals
  FOR SELECT TO authenticated USING (public.is_org_member (org_id));

-- work_assignments has no org_id of its own — scope via its case's org.
CREATE POLICY "org_read_work_assignments" ON public.work_assignments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = work_assignments.case_id AND public.is_org_member (c.org_id)
    )
  );
