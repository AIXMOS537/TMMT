-- Allow ClickUp tasks created from GHL (no TMMT case yet)
ALTER TABLE public.clickup_tasks
  ALTER COLUMN case_id DROP NOT NULL;
