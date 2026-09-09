-- REVIEW CANDIDATE ONLY. Complements app validation with an atomic DB invariant.
-- Requires date-typed columns; fails without altering data if old inversions exist.
begin;
alter table public.contracts
  add constraint contracts_date_order check (end_date >= start_date);
commit;
