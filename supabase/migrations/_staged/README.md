# STAGED migrations — written, reviewed, NOT applied

Files here are complete migrations that the app is already written to tolerate
without, and that need an explicit owner "apply" (OWNER_DECISIONS D-18: production
writes stay owner-gated). The `_staged/` prefix keeps `supabase db push` and the
migration runners from picking them up.

Each file carries WHY, SAFETY, ROLLBACK and a pre-apply TEST query in its header.
Apply one at a time; move the file into `supabase/migrations/` with its real
version number when it lands, and record it in `supabase/schema/`.

| File | App change it hardens | Status |
|---|---|---|
| `20260908000000_agent_messages_provider_sid_index_STAGED.sql` | inbound-SMS replay gate (`src/app/api/agent/sms/inbound/route.ts`, F-01) | staged |
