# GHL Lane Wiring — Brand Architecture v1.0

Implements the exclusive cross-referral lanes from `~/Documents/Business/EMPIRE_BRAND_ARCHITECTURE.md`
inside GoHighLevel. Exclusivity must be enforced by the system, not by memory.

**Lanes:**
- **Lane A** (`lane-a-credit`): all credit-repair / funding-readiness demand → Moe Legacy.
- **Lane B** (`lane-b-transport`): all vehicle demand (rental / lease / buy / fleet) → TMMT.

## 1. Tags (create once, exact spelling)

| Tag | Meaning |
|---|---|
| `lane-a-credit` | Contact routed to Moe Legacy credit/funding lane |
| `lane-b-transport` | Contact routed to TMMT transportation lane |
| `lane-a-source-tmmt` | Lane A client originally sourced by TMMT (retail-minus-COGS economics) |
| `lane-a-source-moe-ads` | Lane A client from Moe's own ad spend (100% Moe's customer) |
| `lane-b-source-moe` | Lane B client referred by Moe Legacy (Operator #1 commission applies) |

Keep the existing `aff: <code>` note attribution untouched — lane tags are additive.
Moe's operator attribution for Lane B uses his affiliate code like any operator.

## 2. Custom field

- `lane_handoff_at` (date) — set by the handoff workflows below; lets us measure
  lane volume per week for the Friday Recap.

## 3. Workflows

### W1 — Lane A handoff (credit intent detected)
- **Trigger:** tag `credit-consult-booked` added, OR form `credit-funding-intake`
  submitted, OR AI agent flags credit/funding intent.
- **Actions:** add `lane-a-credit`; add `lane-a-source-tmmt` unless contact already has
  `lane-a-source-moe-ads`; set `lane_handoff_at`; notify Moe Legacy pipeline (assign to
  Moe Legacy sub-account/pipeline stage "New — from ecosystem"); SMS continues from the
  Moe Legacy-branded agent (Riley).

### W2 — Lane B handoff (vehicle intent detected)
- **Trigger:** AI agent flags "funded / needs vehicle", OR tag `funded` added, OR rental
  inquiry form submitted on a Moe Legacy surface.
- **Actions:** add `lane-b-transport` + `lane-b-source-moe` (when source is a Moe surface);
  set `lane_handoff_at`; stamp Moe's affiliate code into notes (`aff: moe-legacy`) if no
  prior first-touch code exists (first-touch wins — never overwrite an existing code);
  assign to TMMT RENTALS pipeline stage "New — from Moe Legacy"; agent Taj takes over.

### W3 — Lane integrity guard (weekly)
- Scheduled weekly: list contacts with `lane-a-credit` not in a Moe pipeline, and
  `lane-b-transport` not in a TMMT pipeline → post count to Slack #ops. Zero is the goal.

## 4. Attribution rules (must match Operator Agreement §3e)

1. First-touch is permanent: never overwrite an existing `aff:` code.
2. Moe Legacy = Operator #1: Lane B handoffs without prior attribution credit `moe-legacy`.
3. TMMT-sourced Lane A clients keep TMMT economics (retail collected by TMMT; Moe invoiced
   as COGS) — the `lane-a-source-*` tags are what the bookkeeping reads each month.

## 5. Friday Recap additions

Add four numbers: Lane A handoffs, Lane B handoffs, lane-integrity violations, and
`aff: moe-legacy` attributed collections (his commission accrual sanity check).

## Build checklist

- [ ] 5 tags created
- [ ] `lane_handoff_at` custom field created
- [ ] W1 built + tested with a dummy contact
- [ ] W2 built + tested with a dummy contact (verify first-touch code NOT overwritten)
- [ ] W3 scheduled, posting to #ops
- [ ] Moe Legacy pipeline stage "New — from ecosystem" exists
- [ ] TMMT RENTALS pipeline stage "New — from Moe Legacy" exists
