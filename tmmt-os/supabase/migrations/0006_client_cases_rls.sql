-- Clients can read and open support cases tied to their login email.

drop policy if exists cases_client_email_read on public.cases;
create policy cases_client_email_read on public.cases for select
  using (
    customer_email is not null
    and lower(customer_email) = lower((select email from public.profiles where id = auth.uid()))
  );

drop policy if exists cases_client_insert on public.cases;
create policy cases_client_insert on public.cases for insert
  with check (
    customer_email is not null
    and lower(customer_email) = lower((select email from public.profiles where id = auth.uid()))
  );
