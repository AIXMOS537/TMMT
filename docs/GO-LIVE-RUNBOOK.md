# Go-live runbook — do all (≈45 min)

Run from repo root with `.env.local` filled (Supabase service role + GHL API key).

```bash
cd ~/Projects/TMMT

# 1. Audit everything (safe, no mutations)
npm run go-live

# 2. Export operators from Airtable → operators.csv (if People table is ready)
npm run export-operators
npm run provision-operators -- --file operators.csv --dry-run
npm run provision-operators -- --file operators.csv          # creates users, prints passwords once

# Or one operator:
npm run provision-operators -- --email sam@x.com --role operator --affiliate-code SAM01

# 3. GHL checkout URLs (after creating products in GHL UI)
npm run ghl:discover              # lists products → map to env vars
# Paste URLs into .env, then:
npm run ghl:check
npm run ghl:sync-vercel           # pushes to Vercel production
# Redeploy in Vercel dashboard

# 4. Webhook smoke (prod)
GHL_TEST_BASE_URL=https://tmmt-ops.vercel.app npm run ghl:test-webhook payment

# 5. Hand operators
#    OPERATOR-START-HERE.md (repo root)

# 6. Dealers (separate instance — NOT shared DB)
#    docs/sales/DEALER-KIT-ONE-PAGER.md
```

## Docs map

| Step | Doc |
|------|-----|
| Operators | `OPERATOR-START-HERE.md` |
| Payments / `/build` | `docs/HIGH-TICKET-GO-LIVE.md` |
| GHL webhook | `docs/GHL-WEBHOOK-SETUP.md` |
| Kit catalog | `docs/SALES-CHANNELS.md` |
| Dealer sales | `docs/sales/DEALER-KIT-ONE-PAGER.md` |

## What stays manual (cannot break prod from scripts)

- Creating GHL Stripe products + checkout links (GHL UI)
- Pasting checkout URLs into `.env` / Vercel
- GHL workflow → `POST /api/webhooks/ghl`
- Sending one-time passwords to operators (Signal / iMessage)
- Independent dealers → deployed kit, not shared Supabase tenant

## One-shot apply (after operators.csv exists)

```bash
npm run go-live -- --apply
```

Runs live provision + prod webhook test. **Do not use `--apply` until `operators.csv` has real emails.**
