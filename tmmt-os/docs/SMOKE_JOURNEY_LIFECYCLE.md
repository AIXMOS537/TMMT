# Smoke test — Client journey lifecycle (E2E)

Prerequisites: migrations `0014_client_journey_lifecycle.sql` and `0015_journey_starter_entitlements.sql` applied; test renter has Growth/Elite (or Starter + journey entitlements).

## 1. GHL → rental (existing)

1. Move contact in **TMMT Rentals** pipeline → webhook hits `/api/webhooks/ghl`
2. Confirm `/client/rental` shows updated stage for renter email

## 2. Credit path (staff)

1. `/internal/journey` → search renter email
2. Assign **Path A** or **Path B** → verify `rental_ledger` rows in `/internal/ledger`
3. Optional: confirm GHL tags `credit:monthly-97` or `credit:plan-250-250` when `GHL_API_KEY` set

## 3. Education + training (client)

1. `/client/credit` → acknowledge all sections
2. `/client/training` → complete all core modules to 100%
3. `/client/path` → gates show education + training complete

## 4. Good standing + LTO

1. Ensure active booking + no overdue ledger payments
2. Run cron:
   ```bash
   curl -X POST "http://localhost:3000/api/cron/journey-recompute?email=renter@example.com" \
     -H "Authorization: Bearer $CRON_SECRET"
   ```
3. For dev: manually insert `journey_checkpoint_events` row `day_90_good_standing` if needed
4. `/client/path` → **LTO eligible**; `/client/documents` unlocks LTO section

## 5. LTO documents (staff)

1. `/internal/journey/[email]` → **Create LTO agreement** (optional VIN)
2. **Record vehicle turnover** → `vehicle_turnover_complete` checkpoint
3. Client `/client/documents` lists contract instances

## 6. Operator program

1. `/internal/operators` or journey detail → rubric **≥70** (60–69 = GHL nurture only)
2. Client gains `operator_candidate` entitlement → `/client/upgrade` shows **Partner with TMMT**
3. Record **revenue split** row → appears under Revenue splits
4. GHL custom fields `operator_rubric_score`, `operator_pipeline_stage` updated when API configured

## 7. Command Center bridge (optional)

Set `COMMAND_CENTER_SUPABASE_URL` + `COMMAND_CENTER_SUPABASE_SERVICE_KEY` (root TMMT app).

1. `/internal/journey/[email]` → **Command Center (read-only)** shows legacy `contracts` + `background_checks`

## 8. Restoration pipeline (GHL manual)

Separate pipeline **TMMT Restoration** — see `INTEGRATIONS/GHL_RESTORATION_PIPELINE_BLUEPRINT.md`. Do not mix credit stages into Rentals pipeline.
