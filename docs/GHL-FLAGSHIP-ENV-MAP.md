# GHL Flagship env map — AIXMOS one service, two doors

**Owner:** PROJECT X HAILMARY · **Public product:** AIXMOS  
**Do not** `--live` write into NXT GLOBAL / Aayan. Taha agency only.

Until checkout URLs are pasted, Buy buttons resolve to `allinonemanagementsolutions.com` with a campaign UTM (never `#checkout-pending`).

## P0 — paste into Vercel (tmmt-ops, tmmt-command-center, aixmos-landing)

| Env var | SKU | Door | GHL product name to create | On-purchase tags |
|---------|-----|------|----------------------------|------------------|
| `NEXT_PUBLIC_GHL_CHECKOUT_97` | Operator | Entrepreneur | AIXMOS Operator $97/mo | `member-97`, `ready-for-aixmos` |
| `NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT` | Ops Kit | Dealer floor | AIXMOS Ops Kit $997 | `dealer-prospect`, `kit-ordered-ops-kit` |
| `NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_KIT` | Command | Dealer owner | AIXMOS Command Kit $2,997 | `kit-ordered-command-kit` |
| `NEXT_PUBLIC_GHL_CHECKOUT_DEALER_BUNDLE` | Dealer Bundle | Flagship | AIXMOS Dealer Bundle $3,497 | `dealer-prospect`, `kit-ordered-dealer-bundle` |
| `GHL_WEBHOOK_SECRET` | auth | all | (not a product) | header `x-ghl-webhook-secret` or `x-ghl-secret` |
| `SUPABASE_SERVICE_ROLE_KEY` | spine | all | (already exists — restore if missing) | leads webhook 503 until set |

## P1 — after P0 takes money

| Env var | Purpose |
|---------|---------|
| `NEXT_PUBLIC_GHL_CHECKOUT_OPS_MONTHLY` | Ops $297/mo recurring |
| `NEXT_PUBLIC_GHL_CHECKOUT_DEALER_MONTHLY` | Bundle $697/mo recurring |
| `NEXT_PUBLIC_GHL_OPERATOR_APPLY` | Operator application funnel |
| `NEXT_PUBLIC_OWNER_HUB_HOST` | `ops.allinonemanagementsolutions.com` after DNS CNAME |

Credit / LLC / high-ticket vars stay **legal-gated**. Do not sell them on dealer pages.

## Webhooks (GHL workflow → Vercel)

```
POST https://tmmt-ops.vercel.app/api/webhooks/ghl
POST https://tmmt-ops.vercel.app/api/webhooks/ghl/form
Header: x-ghl-webhook-secret: <same secret as Vercel>
```

Tags that grant / queue:

- `member-97` → 500 tokens / month
- `kit-ordered-ops-kit` → Ops provision queue
- `kit-ordered-dealer-bundle` → Dealer Bundle provision queue

After paste: `npm run ghl:sync-vercel` then `bash scripts/ship.sh`.

## Taha agency (not Aayan)

Copy `docs/taha-agency.env.example` → `~/.config/tmmt/taha-agency.env` (chmod 600).  
Fill `GHL_LOCATION_ID` + `GHL_PIT` for **Taha's** location only.
