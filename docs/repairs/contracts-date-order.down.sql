-- Rollback only this named invariant; no contract data changes.
begin;
alter table public.contracts drop constraint contracts_date_order;
commit;
