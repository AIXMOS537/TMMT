# Communication Channel Topology

**Date:** 2026-06-16
**Goal (owner):** wire every number to exactly one job, and enforce who may be
contacted. Registry: `comm_channels` (migration `20260616400000`). Policy library:
`src/lib/channels.ts`. Owner escalation: `src/lib/escalate.ts`.

---

## The four channels

| Channel | Number | Provider | Purpose | Policy |
|---|---|---|---|---|
| **GHL** | (set in GHL) | `ghl` | Campaigns, ads, **leads management** — top-of-funnel marketing | normal |
| **Quo** | +1 PHONE-REDACTED | `quo` | **Customer satisfaction + support**, and the internal line vendors call/reach out to | normal |
| **Work cell** | +1 PHONE-REDACTED | `work_cell` | The owner's **working-hours** line, bridged to the **Mac M1** = top-tier assistant. Receives escalations. | escalation_only |
| **Personal** | +1 PHONE-REDACTED | `personal` | The owner's private line — **ideally gets nothing** | **do_not_contact** |

## How each is wired

- **GHL → leads:** inbound marketing already flows through the GHL webhooks
  (`/api/webhooks/ghl/*`) into `incoming_leads` / cases. GHL stays the
  campaign/ads/lead-capture front door. (Its number lives in GHL; the registry
  row is a placeholder you can fill with the actual DID.)
- **Quo → support + vendors:** the sole backend support number
  (`/api/webhooks/quo` → brain → routing). Vendors also use Quo to call/reach in;
  vendor candidates are in the routing pool, so vendor contact and dispatch share
  one channel.
- **Work cell → owner assistant:** escalations route here via
  `escalateToOwner()`, **working-hours aware** (Mon–Sat 08:00–20:00
  America/New_York by default — editable in `comm_channels.working_hours`).
  Delivery transport is pluggable:
  - `IMESSAGE_BRIDGE_URL` (+ optional `IMESSAGE_BRIDGE_TOKEN`) — your Mac M1
    iMessage bridge **exposed over Tailscale** (the bridge is local-only, so a
    server reaches it across the mesh; see `docs/MAC-IMESSAGE-BRIDGE.md`).
  - If no transport is set, the escalation is **recorded in the brain as queued**
    (never lost).
  Outside working hours, non-forced escalations are queued, not sent.
- **Personal → silence:** policy `do_not_contact`. `isDoNotContact()` is the hard
  guard every outbound path must call; `escalateToOwner` already refuses to send
  to any do_not_contact number. The personal line therefore never receives
  automated contact.

## Enforcement points (in code)

- `getEscalationChannel()` — picks the highest-priority work-cell/escalation line.
- `isWithinWorkingHours(wh)` — tz-aware gate for when the owner is contactable.
- `isDoNotContact(phone)` — **call before any automated SMS/call**; protects the
  personal line (and anything else marked do_not_contact).
- `escalateToOwner(text)` — wired into routing: when work has **no eligible
  candidate**, the owner's work cell is alerted (within hours), never the
  personal line.

## What only you can do
- Put the real **GHL DID** into the GHL channel row (or leave GHL to manage it).
- Stand up the **Mac M1 iMessage bridge over Tailscale** and set
  `IMESSAGE_BRIDGE_URL` so escalations land as iMessages on the work cell.
- Adjust `working_hours` to your real schedule.
- Top up Quo credits so outbound support replies actually send.

## Escalation flow (current)

```
routeWork(case) finds NO eligible candidate
   → logMemoryEvent(work_unassigned)
   → escalateToOwner("case … needs attention")
        → work cell, IF within working hours
        → via Tailscale iMessage bridge if configured, else queued in brain
        → NEVER the personal line (do_not_contact guard)
```
