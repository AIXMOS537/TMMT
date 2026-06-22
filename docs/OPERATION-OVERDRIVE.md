# Operation Overdrive — mission-critical logistics & emergency response

> A separate product (not the OVERHAUL configurator). The vision: vehicles +
> ready-to-go drivers who **don't fold under pressure**, getting from point A to
> point B in due time **without compromising the mission**. Start small, grow into
> a city-serving emergency-response department.

**Status:** planned (registered as vertical `vp-overdrive` in OVERHAUL).
**Built on:** the existing dispatch-core (`docs/DISPATCH-CORE.md`,
`supabase/migrations/20260530120000_rescue_dispatch_core.sql`).

## Phased growth

| Phase | What | Vehicles |
|---|---|---|
| 1 — Courier | **Medical courier** runs (labs, specimens, pharmacy, documents) — prove reliability + SLAs | Economy / utility |
| 2 — Priority | Time-critical B2B + healthcare logistics; driver standards + training | Utility / vans |
| 3 — Response | Integrated emergency-response department; mission-grade drivers | Sports / custom utility |

## Core capabilities (reuse dispatch-core)

- Mission intake → driver assignment → A→B tracking → proof-of-delivery.
- Driver roster with readiness/standards (the "don't fold under pressure" bar).
- SLA timers + escalation; mesh + brain for coordination.
- Compliance/chain-of-custody for medical courier (HIPAA-aware handling).

## Open questions (discovery before build)

- Jurisdiction + licensing for medical-courier and (later) emergency response.
- Insurance / liability model; driver vetting + certification.
- First market + first contracts (which clinics/labs/pharmacies).
- Build on dispatch-core as a new org/vertical vs. its own app.

> Legal & safe only. Emergency-response and medical handling carry real
> regulatory weight — this doc is a vision capture, not an authorization to
> operate. Confirm licensing/compliance before any live operation.
