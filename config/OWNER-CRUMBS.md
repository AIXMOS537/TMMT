# Owner crumbs — GET PAID (5–15 minutes)

Everything else is automated. You only touch GoHighLevel.

## One command on Carry

```bash
cd ~/Projects/TMMT && x --money
```

This auto-generates `GHL_WEBHOOK_SECRET` and prints your webhook URL.

## Paste file (fastest)

Edit `~/.config/tmmt/ghl-paste.env` — one line per checkout:

```
NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT=https://...
NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_KIT=https://...
NEXT_PUBLIC_GHL_CHECKOUT_DEALER_BUNDLE=https://...
NEXT_PUBLIC_GHL_CHECKOUT_97=https://...
NEXT_PUBLIC_GHL_UPSELL_PIPELINE_URL=https://...
```

Then:

```bash
x --money apply
npm run ghl:sync-vercel
bash scripts/ship tmmt-ops
```

## GHL UI (if not using paste file)

1. **Products** — create checkouts for Ops Kit, Command Kit, Dealer bundle, $97/mo
2. **Workflow** — webhook → `POST https://tmmt-ops.vercel.app/api/webhooks/ghl` + secret from `x --money`
3. **Tags** — `member-97`, `ready-for-aixmos`, `tmmt-customer` (see `docs/GHL-PIPELINE-SETUP.md`)

## Visual command center

Open after deploy: **tmmtrentals.net/command/race** (owner hub)

See every racer on the TRAP track, empire goal ($1M/mo), and live blockers.

## No employees until paid

- 1–5 executive VAs when revenue supports it
- Student-operators **pay you** (ladder $1,875–$100K) — they are the sales force
- AI qualifies; GHL collects; you watch the race board
