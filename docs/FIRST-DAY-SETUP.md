# First-Day Setup — across the board

For **TMMT (owner + team)** and **Moe Legacy (Moe + team)** to start using the
new platform day one. Ties the new systems (brain, support routing, channels,
HAILMARY) into what the team already uses (Slack, GHL, TMMT OS, Brainiac).

## Who gets what (roles)
- **Owner / admin (you):** full access; exempt from the backend lock.
- **Team (employees/operators):** their org's data only (org-scoped reads now
  enforced); work in TMMT OS + Slack.
- **Vendors:** routed work + the Quo line; no backend.
- **Clients (Moe Legacy as a tenant):** see only their org via `org_roles`.

## Per-person, day one (5 minutes)
1. **Slack** — accept invite; read `#general` (TMMT) / `#moe-ops` (Moe). Slack = the work hallway.
2. **TMMT OS** — log in at https://tmmt-ops.vercel.app (temp password in DM; change it).
3. **GHL** — confirm sub-account access (TMMT: 4 sub-accounts; Moe: his location).
4. **Brain** — on Tailscale, ask the TMMT Brain at the Brainiac endpoint, or use
   `hailmary recall "<question>"` once HAILMARY is set up (Macs).

## Per-org activation (owner/admin, one time)
Run for **each** org (TMMT org `8e651b25…`, Moe Legacy `bbbbbbbb…`):

1. **org_roles** — add each member: `tenant_admin | dispatcher | responder | viewer`.
   This is what powers the new org-scoped reads (members see only their org).
2. **routing_candidates** — register the org's people/vendors/units with real
   `capability_tags` + `vertical_slugs` + availability (seeded from
   vendors/profiles/units; refine per org).
3. **customer_services** — load each client's opted-in service (gates Quo support).
4. **verticals** — add the org's business lines (TMMT: rentals/detailing/moving/
   xpress; Moe: his services).
5. **comm_channels** — confirm GHL DID + Quo number + work-cell hours.
6. **installations** (for the $50k backend lock, when used) — create the row and
   drive `paid → setup → comprehension → active`. Owner is always exempt.

> Note: tenant **licenses/kill-switch** already live in `organization_licenses`
> (AIXMOS/Moe/TMMT seeded). The new `installations` table is the *backend-lock*
> layer and is complementary — not a replacement.

## Daily rhythm (unchanged + augmented)
- ☀️ Morning → Slack (`#general` / `#moe-ops`).
- 🛠️ Day → work in TMMT OS; **support calls/texts auto-route** via Quo → brain →
  best candidate; ask the brain / `hailmary recall`.
- 🚨 Emergency → WhatsApp your lead; the system escalates unrouteable work to the
  **owner work cell** in working hours (never the personal line).
- 🌙 Night → one line in Slack: done + stuck. (HAILMARY can leave cross-device
  notes: `hailmary note <node> "…"`.)

## What's new that "just works" now
- **One brain** remembers every actor across both orgs (org-isolated reads).
- **Quo support line** → auto-routed to the best employee/agent/vendor/unit.
- **Channel safety** → personal line never contacted; escalations hit the work cell.
- **HAILMARY** → your cross-device agent (work Mac, carry Mac, iPhones).

## Verify (smoke, per org)
1. A member logs in → sees only their org's records.
2. A test support text to the Quo number → appears in the brain, routes to a
   candidate, assignee pinged.
3. `hailmary status` on a Mac → brain reachable.

See `docs/LAUNCH-READINESS.md` (env/webhooks/crons), `docs/QA-SECURITY-REPORT.md`
(security posture), `docs/GO-TO-MARKET.md` (packaging/scale).
