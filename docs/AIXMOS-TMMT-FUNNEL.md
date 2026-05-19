# AIXMOS × TMMT — Revenue funnel

**One app:** Vercel `tmmt-c919` → `AIXMOS537/TMMT`  
**Distribution:** TMMT car business (rental, lease, chauffeur, dealership path)  
**Monetization:** AIXMOS (membership → credit guidance → funding)

## Funnel sequence (do not skip steps)

| Step | Trigger | Offer | System |
|------|---------|-------|--------|
| 1 | Books / completes rental | Deliver 5-star car service | TMMT OS (`/fleet`, `/customers`, GHL `tmmt-customer`) |
| 2 | 7–14 days after positive return | Check-in only — no credit pitch | GHL post-rental nurture |
| 3 | VA marks `ready-for-aixmos` | Introduce **$97/mo membership** | GHL + `/aixmos` checkout |
| 4 | Active member + intake complete | **Credit guidance** $500–$1K | GHL stages + SOP |
| 5 | Credit guidance complete | **Funding prep** handoff | SOP + partner/vendor |

## GHL tags (minimum)

- `tmmt-customer` — any renter
- `rental-active` / `rental-completed`
- `ready-for-aixmos` — **only** after successful rental (manual or workflow)
- `member-97` — paying membership
- `credit-guidance-active` — in credit program

## Domains

| Host | Audience |
|------|----------|
| `allinonemanagementsolutions.com` | Public AIXMOS + forms; unauthenticated `/` → AIXMOS landing |
| `allinonemanagementsolutions.net` | Owner only → `/command` hub |

## Owner daily checks

- **Mon:** Membership offers sent vs conversions (GHL filter `ready-for-aixmos`)
- **Wed:** Credit guidance pipeline counts
- **Fri:** Tag audit — no `ready-for-aixmos` before `rental-completed`

## Compliance

- Say **credit guidance**, not “credit repair”
- No guaranteed score outcomes ([`ops-company-policy.md`](ops-company-policy.md))

## Related docs

- [`GHL-PIPELINE-SETUP.md`](GHL-PIPELINE-SETUP.md) — tags, stages, automations
- [`GHL-WEBHOOK-SETUP.md`](GHL-WEBHOOK-SETUP.md) — sync tags into Supabase notes
- [`sops/CREDIT-GUIDANCE-SOP.md`](sops/CREDIT-GUIDANCE-SOP.md)
- [`sops/OPERATOR-NETWORK-SOP.md`](sops/OPERATOR-NETWORK-SOP.md)
- [`sops/FUNDING-HANDOFF-SOP.md`](sops/FUNDING-HANDOFF-SOP.md)
- [`ONE-APP-CONSOLIDATION.md`](ONE-APP-CONSOLIDATION.md)
