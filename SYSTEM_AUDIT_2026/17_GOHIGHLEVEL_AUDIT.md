# 17 · GOHIGHLEVEL AUDIT

## Verdict: 🟢 **The healthiest integration in the system**, and the de-facto CRM source of truth.

`ghl_contacts` = **1,642 rows** — the largest real dataset in the database. `[DB]` GHL intake was still working as of 2026-08-19+ (7 leads, 12 contacts, newest one day old at the time of the prior audit) **while the direct landing-page webhook was dead.** GHL is what kept any lead flow alive.

## Surface
**21 files in `src/lib/ghl/`** + 6 inbound webhook routes + 5 helper modules.

| Direction | Mechanism |
|---|---|
| GHL → App | `/api/webhooks/ghl` + `/contact` `/form` `/appointment` `/overdue` `/program`; handlers in `lib/ghl/handlers/` |
| App → GHL | `sync-outbound.ts`, `sync-contact-portal-fields.ts`, `dealer-lead-sync.ts`, `dispatch.ts` |
| Payments | `ghl-payment-sync.ts` (7 edits — a churn hotspot) |
| Checkout | 12 `NEXT_PUBLIC_GHL_CHECKOUT_*` links (`kits`, `build`, LLC, $97, $3,750, $7,500, $15,000, $25,000) |
| Voice | `lib/agent/voice/ghl-voice-*` (4 files) |
| KPI | `/api/cron/marketing-kpi-ghl` weekly → `marketing_kpi_weeks` |

## Quality — genuinely good
- **Authenticated:** `GHL_WEBHOOK_SECRET` + `lib/ghl/webhook-auth.ts` (tested).
- **Idempotent:** `20260825120000_ghl_webhook_idempotency` — replays are safe.
- **Cache-controlled:** `vercel.json` sets `no-store` on `/api/webhooks/*`.
- **Tested:** 6 dedicated test files.
- **Per-tenant:** `org_ghl_connections`, `org-location.ts`, `client-location.ts`.

## Source-of-truth
| Entity | Truth | Direction | Risk |
|---|---|---|---|
| Contact | **GHL** | GHL → `ghl_contacts` | 🟢 |
| Lead | contested — GHL, `incoming_leads`, **and Airtable** | bidirectional | 🟠 |
| Opportunity/stage | GHL | → `case-status-to-canonical.ts` | 🟡 |
| Appointment | GHL | → `ghl_appointments` (**0 rows**) | 🟡 unproven |
| Payment | GHL checkout → Stripe | `ghl-payment-sync` | 🟠 |
| Conversation | GHL | — | 🟢 |

## Findings
**🟠 G-1 · Three systems can write a lead.** GHL, the app's own webhook, and Airtable's verification automation. Deduplication is partial (`call_sheet_dedupe_and_customer_scrub`). Pick one intake owner.

**🟡 G-2 · `ghl_appointments` = 0 rows** despite a dedicated webhook and handler. Either appointments are not being booked, or the route has never fired. Unverified either way.

**🟡 G-3 · `ghl-payment-sync.ts` has 7 revisions** — the second-most-churned lib file. Money-path instability.

**🟡 G-4 · 12 hard-coded checkout links in env.** Workable, but pricing changes require a redeploy.

## What GHL should own vs the app
| GHL | The app |
|---|---|
| Contacts, conversations, SMS/email delivery | Rental operations, fleet, inspections |
| Pipelines, opportunities, stages | Vehicle/booking state machines |
| Calendars, appointments, reminders | Money ledger, arrears, payouts |
| Checkout links, campaigns, nurture | Licensing, entitlements, portals |
| Round-robin assignment | Compliance gates (DNC, quiet hours) |

**Do not rebuild inside the app:** contact management, campaigns, nurture sequences, appointment reminders. Some of that duplication has already started (`comm_channels`, `outreach_touches`, `agent_conversations`). **`outreach_touches` has 0 rows and GHL already does this** — a clear case of rebuilding a working system.
