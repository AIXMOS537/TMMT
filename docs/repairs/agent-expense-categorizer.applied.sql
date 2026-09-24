-- VERBATIM body applied to prod (uapxakmlwnpfsftfeezx) as ledger version
-- 20260826003248 agent_expense_categorizer (2026-08-26).
-- Copied from supabase_migrations.schema_migrations.statements[1]. Historical
-- record only: do NOT run. The fresh-environment-safe form is in
-- supabase/migrations/20260826003248_agent_expense_categorizer.sql.
-- Everything after the marker line below is byte-identical to the ledger body
-- (md5 ca5e38405787378d9daad42781b5dbe6; checked by
-- scripts/tests/sql/agent-queue-migrations.rehearsal.mjs --verify-verbatim).
-- ===== VERBATIM BODY BELOW =====
-- First agent: the expense categoriser, ported from Airtable automation
-- "Expense Categorization and Monthly Totals Update" (wflSDSZ69uktC4jIk, never deployed).
--
-- One fix carried over: the Airtable version wrote the AI answer back into expense_type,
-- the same field it read as input, so it overwrote real data. Here only_when_null means it
-- fills blanks and never touches a category a human already set.
--
-- The category list is the vocabulary actually present in the table today:
-- Maintenance (19), Other (8), Fuel (6), Insurance (1).

insert into public.agent_definitions
  (slug, name, description, source_table, fire_on, only_when_null,
   target_field, model, temperature, active, prompt_template)
values (
  'expense-categoriser',
  'Expense categoriser',
  'Files a new expense into a category from its vendor and description.',
  'expenses', 'insert', 'expense_type',
  'expense_type', 'rick', 0, true,
$prompt$You file expenses for a vehicle rental business.

Read the expense below and reply with EXACTLY ONE of these categories:
Maintenance
Fuel
Insurance
Other

Rules:
- Repairs, parts, servicing, tyres, body work, cleaning, inspections -> Maintenance
- Petrol, diesel, charging, fuel cards -> Fuel
- Policies, premiums, cover, claims -> Insurance
- Anything that fits none of the above -> Other

Reply with the category word only. No punctuation, no explanation.

Expense
  Vendor / payee: {{vendor_payee}}
  Description:    {{description}}
  Notes:          {{notes}}
  Amount:         {{amount}}
  Vehicle:        {{vehicle_name}}
$prompt$
)
on conflict (slug) do update set
  prompt_template = excluded.prompt_template,
  target_field    = excluded.target_field,
  only_when_null  = excluded.only_when_null,
  active          = excluded.active,
  updated_at      = now();

drop trigger if exists agent_enqueue_expenses on public.expenses;
create trigger agent_enqueue_expenses
  after insert or update on public.expenses
  for each row execute function public.agent_enqueue();