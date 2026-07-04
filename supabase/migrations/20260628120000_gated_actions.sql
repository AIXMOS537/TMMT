-- Owner-Approval Gate — persistence for shared/owner-approval-gate/approval.ts
-- Spec: root CLAUDE.md §2 (THE OWNER-APPROVAL GATE). One row per gated action.
-- Nothing customer-facing or financial executes until status = 'approved'.
-- Staff/owner-only. No anon access. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS gated_actions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- The 7 gated action types from shared/owner-approval-gate/approval.ts (GatedActionType).
  type          text NOT NULL CHECK (type IN (
                  'customer_message',
                  'dispute_letter',
                  'charge_fee',
                  'pay_commission',
                  'submit_funding_app',
                  'move_money',
                  'production_automation_edit'
                )),

  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by    text NOT NULL,

  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected')),

  -- Set only when an owner decides. NEVER auto-approve (approval.ts contract).
  approved_by   text,
  approved_at   timestamptz,
  reason        text
);

CREATE INDEX IF NOT EXISTS gated_actions_status_idx     ON gated_actions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS gated_actions_pending_idx    ON gated_actions (created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS gated_actions_type_idx       ON gated_actions (type);

-- RLS — staff/owner only. Writes flow through the service-role server actions.
ALTER TABLE gated_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_all_gated_actions" ON gated_actions;
CREATE POLICY "staff_all_gated_actions"
  ON gated_actions FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Privilege hardening: no PUBLIC/anon. Service role for server-side writes.
REVOKE ALL ON gated_actions FROM PUBLIC;
GRANT ALL ON gated_actions TO authenticated;  -- still RLS-scoped by is_staff()
GRANT ALL ON gated_actions TO service_role;
