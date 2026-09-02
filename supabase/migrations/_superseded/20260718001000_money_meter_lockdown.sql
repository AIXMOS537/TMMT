-- Lock money_meter_record to service_role ONLY.
--
-- The Supabase security advisor (lints 0028/0029) flagged that the `anon` and
-- `authenticated` roles could execute this SECURITY DEFINER RPC via PostgREST.
-- Because the function bypasses RLS to write, that is an abuse vector: a caller
-- could inject bogus rows into the money ledger. The prior migration's
-- `revoke ... from public` did not cover a Supabase default grant to anon/
-- authenticated. This makes the grant match the documented intent — the server
-- (service_role) is the meter's only writer.
revoke execute on function
  public.money_meter_record(uuid, text, text, numeric, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function
  public.money_meter_record(uuid, text, text, numeric, text, text, text, jsonb)
  to service_role;
