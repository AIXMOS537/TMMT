# S3-03 · Application / API diff preview (contract-level)

The application source (AIXMOS537/TMMT) has not been inspected. This preview states the
RPC contract the migration guarantees, so any caller can be verified against it once the
code is available. No application change is REQUIRED for S3-03 to be safe; changes below
are OPTIONAL adopters.

## 1. Existing call — UNCHANGED, still valid

```ts
// wherever the app decides a background check today (route/server action/edge fn)
await supabase.rpc('bg_check_decide', {
  p_id: checkId,
  p_decision: 'Not Eligible',      // one of the 5 existing states
  p_notes: notes,
});
```
Behavior after S3-03: identical result shape PLUS `decision_event_id` and `reason_code`
keys in the returned jsonb. While `reason_codes` is empty (pre-taxonomy) a null reason is
accepted for every decision.

## 2. New optional parameters (adopt in S3-06-minimal)

```ts
await supabase.rpc('bg_check_decide', {
  p_id: checkId,
  p_decision: 'Not Eligible',
  p_notes: notes,                        // still stored on background_checks.review_notes
  p_reason_code: 'DOC_MISSING',          // required for 'Not Eligible' ONCE the taxonomy is seeded
  p_explanation: 'License photo unreadable',   // human explanation on the event (defaults to p_notes)
  p_product_program: 'rentals_rideshare',      // programs.slug being evaluated (optional)
  p_dedupe_key: `bg:${checkId}:${clientRequestId}`, // idempotency: same key => same event id, no duplicate
});
```

Error contract the UI must surface (SQLSTATE / message prefix):
- `42501` "staff or admin only" — non-staff caller (unchanged)
- `P0001` "reason_code is required for decision Not Eligible once the taxonomy is active"
- `P0001` "reason_code % is not an active reason code"
- `P0001` "an Eligible decision must not carry a reason code"

## 3. New read surface (for the minimal staff screen, S3-06)

```ts
// "Why is this customer where they are?"
const { data } = await supabase
  .from('v_decision_trail')
  .select('*')
  .eq('background_check_id', checkId)
  .order('seq', { ascending: true });
// Columns: decision_event_id, seq, created_at, person_id, background_check_id, lead_id,
//          product_program, decision, previous_decision, reason_code, reason_category,
//          recoverable, explanation, source, rule_version, actor_kind, actor_id,
//          next_destination, routed_at, inputs_snapshot
// RLS: staff/admin only. Contains no names, phones, emails, or attachment refs.
```

```ts
// Reason picker (only shows active codes; empty until the owner seeds the taxonomy)
const { data: codes } = await supabase
  .from('reason_codes')
  .select('code,label,category,remediable_by')
  .eq('active', true)
  .order('category');
```

## 4. Types

After the migration is applied to any environment the app builds against:
```
supabase gen types typescript --project-id uapxakmlwnpfsftfeezx > src/types/supabase.ts
```
(adds `decision_events`, `reason_codes`, `reason_categories`, `v_decision_trail`; changes
`Functions.bg_check_decide.Args` to include the four optional params.)

## 5. PostgREST schema cache

Function signature changes require a schema reload. `supabase db push` triggers it; if applied
by other means run `NOTIFY pgrst, 'reload schema';` after the migration.

## 6. Not in this package (deliberately)

- No trigger on `decision_events` (S3-04 adds the router trigger).
- No consent tables (S3-05).
- No screen (S3-06-minimal).
- No change to `route_intake_event`, `programs`, `compute_*`, `recompute_journey`.
