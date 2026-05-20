-- Enable Realtime for GHL live-sync tables (internal /ghl-sync dashboard).

do $$ begin
  alter publication supabase_realtime add table public.ghl_contacts;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.ghl_form_submissions;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.ghl_appointments;
exception when duplicate_object then null; end $$;
