-- STAGED 2026-09-08 (owner review; not applied). Source: docs/repairs/contracts-date-order.sql
-- Rollback: docs/repairs/contracts-date-order.down.sql (drops only this named constraint).
--
-- What changes: an atomic CHECK that a contract's end_date is never before its start_date, so a
-- partial or concurrent one-date edit cannot invert a contract. The app-side check (rental-write
-- validation) is not a concurrency guarantee; this constraint is. Nulls pass (open-ended contracts).
-- This is NOT a vehicle double-booking constraint.
--
-- Ledger drift: public.contracts and its date columns were created live, not through this directory.
-- Guarded: adds the constraint where the table/columns exist and the constraint is absent (live);
-- NOTICE and skip otherwise. Adding the constraint FAILS, changing nothing, if inverted rows exist:
-- run `select count(*) from public.contracts where end_date < start_date` first (was 0 on 2026-09-07).
do $stage$
begin
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'contracts'
         and column_name in ('start_date', 'end_date')
         and data_type in ('date', 'timestamp with time zone', 'timestamp without time zone')) <> 2 then
    raise notice 'contracts_date_order: public.contracts date columns absent; skipped';
    return;
  end if;
  if exists (select 1 from pg_constraint where conname = 'contracts_date_order'
               and conrelid = 'public.contracts'::regclass) then
    raise notice 'contracts_date_order: constraint already present; skipped';
    return;
  end if;

  alter table public.contracts
    add constraint contracts_date_order check (end_date >= start_date);
end
$stage$;
