-- customer_services.status allowed only active/trial/paused/cancelled -- the
-- vocabulary of a service someone is already enrolled in. An opt-in from the public
-- waitlist form is not that: it is a REQUEST to be told more, and the person has
-- agreed to nothing and paid nothing.
--
-- Recording one as 'active' would put a paying-customer state on a ticked box: wrong
-- in the record, and wrong in how it would be followed up. 'requested' is added as
-- the honest first state of the lifecycle.
--
-- The anon policy in 20260910120000_anon_insert_customer_services pins public
-- submissions to exactly this value, so nobody can write themselves further along
-- than a request. Staff move a row onward from there.

alter table public.customer_services drop constraint if exists customer_services_status_check;

alter table public.customer_services add constraint customer_services_status_check
  check (status = any (array['requested'::text, 'active'::text, 'trial'::text, 'paused'::text, 'cancelled'::text]));
