# TMMT Restoration — GHL Pipeline Blueprint

**Location ID:** `EaRPXFwPZbqCM9pynHwt` (from your GHL launchpad URL)

Keep credit repair **out of** the TMMT Rentals pipeline. Use a separate pipeline: **TMMT Restoration**.

## Stages (suggested)

| # | Stage | Notes |
|---|--------|--------|
| 1 | Enrolled | Base path assigned (A or B) |
| 2 | Education complete | All ack sections done in portal |
| 3 | Training active | Core modules in progress |
| 4 | Training complete | Core modules 100% |
| 5 | Mentorship active | Path C $1k paid — done for you |
| 6 | LTO eligible | TMMT OS `lto_eligible` true |
| 7 | LTO in progress | Agreement / vehicle assigned |
| 8 | Closed | Program complete or lost |

## Tags

| Tag | When |
|-----|------|
| `credit:monthly-97` | Path A active |
| `credit:plan-250-250` | Path B active |
| `credit:mentorship-dfy` | Path C paid |
| `credit:training-active` | Started core training |
| `credit:plan-overdue` | Path B balance overdue |
| `lto:eligible` | All LTO gates met |

## Webhook

Reuse WF-00 pattern from [GHL_RENTAL_PIPELINE_BLUEPRINT.md](GHL_RENTAL_PIPELINE_BLUEPRINT.md):

- POST `https://<your-tmmt-os-host>/api/webhooks/ghl`
- Header `X-GHL-Secret: <GHL_WEBHOOK_SECRET>`
- Body includes `pipeline_name: "TMMT Restoration"` and `stage`

TMMT OS maps stages via `GHL_PIPELINE_STAGE_MAP_JSON` (add restoration pipeline entries).

## Products / amounts

| SKU | Amount |
|-----|--------|
| Path A | Up to $97/mo |
| Path B | $250 + $250 (30–45 days) |
| Path C | $1,000 mentorship DFY |

Ledger lines are created in TMMT OS when staff assigns paths from `/internal/journey/[email]`.
