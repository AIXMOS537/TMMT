-- First agent: the expense categoriser (fills expenses.expense_type only when blank).
-- APPLIED to prod as ledger version 20260826003248 (2026-08-26). Exact applied
-- body kept verbatim in docs/repairs/agent-expense-categorizer.applied.sql.
--
-- Repo form differences (fresh-environment safety only; same objects on prod):
--   * public.expenses is not created by any repo migration. The agent definition
--     row is seeded regardless (it is inert without the table); the enqueue
--     trigger is created only if public.expenses exists.
-- Re-running by hand is harmless: ON CONFLICT (slug) DO UPDATE and drop+create trigger.

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

do $guard$
begin
  if to_regclass('public.expenses') is null then
    raise notice 'expense categoriser: public.expenses absent; enqueue trigger not created';
    return;
  end if;
  execute 'drop trigger if exists agent_enqueue_expenses on public.expenses';
  execute 'create trigger agent_enqueue_expenses
             after insert or update on public.expenses
             for each row execute function public.agent_enqueue()';
end
$guard$;
