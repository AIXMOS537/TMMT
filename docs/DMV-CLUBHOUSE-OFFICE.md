# The DMV Clubhouse — TMMT Rentals HQ (Virginia)

> X's office buildout: the **Ultimate Clubhouse (the "Traphouse")** for TMMT
> Rentals and its operators across the **DMV** (DC · Maryland · Virginia).
> The physical extension of the homeland HQ — same brain, same tailnet, real
> walls. Topology lives in `FLEET-ROSTER.md` + `HOMELAND-HQ-AND-OPERATOR-SEATS.md`.

## The idea

Home is the always-on brain today; the **Virginia office becomes the operator
HQ** once it's remodeled — a place operators *come to* to work, train, close, and
level up, and reach *from the field* when they're out in the DMV. Not a separate
island: it joins the **same Tailscale mesh** as more seats on the same network.

## What makes it the clubhouse (not just an office)

| Zone | What it's for | Tech |
|---|---|---|
| **The War Room** | Daily standup + the big screen running the **Architect's Cockpit** + Watchtower health | Wall display → `bash scripts/hologram` + `watchtower` |
| **Operator Bays** | Per-seat desks — each operator on their **own subaccount**, one-shot device | `scripts/deploy operator` (fenced) |
| **The Brain Closet** | A local always-on node (office twin of `brainiac-win`) + NAS for files | Tailscale `tag:brain`/office node + UGREEN NAS |
| **The Close Room** | Quiet room for calls/closing — credit **guidance**, funding, rentals | Phones/VoIP, no personal numbers |
| **The Set** | Content/creator corner — record, post, build the brand (X = AIXMOS) | Lighting + creator vertical |
| **The Lounge** | The "clubhouse" — culture, food, where the crew actually wants to be | — |

## Network + security (same model as home)

- **One tailnet.** Office workstations onboard exactly like any node. Operators
  get **fenced, least-privilege** access; the brain stays **owner-only**
  (`tag:brain` ACL in `infra/tailscale-acl.jsonc`).
- **Zero secrets on operator machines** — thin-client by design (Operator
  Portable Kit). They sign into accounts you granted; nothing to leak or break.
- **Office brain node** = an always-on box in the Brain Closet (UPS-backed),
  warm-linked to the home brains for failover. Resilience model:
  `BRAINIAC-RESILIENCE.md` (UPS, power, offsite backup, heartbeat).
- **Compliance is the house rule:** credit = **"guidance," never "repair";** no
  guaranteed outcomes (`docs/sops/CREDIT-GUIDANCE-SOP.md`).

## Phased buildout (after the remodel)

1. **Connect** — Tailscale on every office machine; office joins the mesh; the
   Brain Closet node up + UPS + offsite backup.
2. **Seat it** — operator bays via `scripts/deploy operator`; each operator their
   own subaccount ($97/mo seat).
3. **Light it up** — War Room display running the Cockpit + Watchtower; the Set
   for content; the Close Room for calls.
4. **Run it** — daily standup at the big screen, the crew works the DMV, every
   seat billing recurring. Home HQ + office = one operation.

## Money tie-in (why the clubhouse pays)

Every desk in the office is a **billable seat** ($97/mo) on top of whatever the
operator's vertical earns (BUILD once + RUN monthly — `OFFER-STACK.md`). The
clubhouse turns culture into **MRR**: operators *want* to be there, they close
more, every seat compounds.

> Real-estate, lease, permits, and buildout costs are **owner + local-pro
> decisions** (contractor, landlord, county) — this doc is the **systems/network
> blueprint** for the office, not construction or legal advice.
