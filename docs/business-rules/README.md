# Business rules — the specification that does not export

Phase 3 of `AIRTABLE-EXIT-EXECUTION-PLAN.md`. Airtable holds a year of operating rules encoded
as formulas, select options and field descriptions. **A data migration carries none of it.**
These documents are the extraction.

This is the configuration spec for every client install. It is a deliverable, not documentation.

## Documents

| # | Domain | File |
|---|---|---|
| 1 | Eligibility & screening | `01-eligibility-and-screening.md` |
| 2 | Do-not-rent criteria | `02-do-not-rent-criteria.md` |
| 3 | Pricing bands | `03-pricing-bands.md` |
| 4 | Partner economics | `04-partner-economics.md` |
| 5 | Vehicle status lifecycle | `05-vehicle-status-lifecycle.md` |
| 6 | Customer lifecycle | `06-customer-lifecycle.md` |
| 7 | Handover requirements | `07-handover-requirements.md` |

## How to read these

Every rule carries four lines:

- **Rule** — what the system actually did.
- **Encoded in** — the exact field/formula it lived in, so the claim is checkable.
- **Consistently enforced?** — VERIFIED against live data where possible. *This is the most
  valuable line in the document.* Plan §5: *"Several were not consistently enforced — that is a
  finding, and it is more valuable than the rule itself. Write it down rather than quietly
  fixing it."*
- **Disposition** — carry forward / change / drop. **Every one is currently
  `DECISION REQUIRED`.** Claude Code documents what was; the owner decides what carries forward.
  Prime Directive 5 forbids inventing a business rule, and silently promoting an observed
  behaviour into a product default is exactly that.

## Gate 3 status

- [x] Seven rule documents written
- [ ] Each rule tagged carry forward / change / drop **with the owner's decision recorded**
- [x] Rules that were not consistently enforced are named as such

**Gate 3 does not pass until the owner works the `DECISION REQUIRED` lines.**

## The three findings that matter most

1. **36 of 43 vehicles (84%) have no partner percentage recorded** (`04`). Partner opacity was
   named as the mechanism of business failure. The data shows the split was mostly not written
   down at all.
2. **The going-forward tier model does not cover the historical data** (`04`). Tiers are
   70/30, 60/40, 50/50. Two live vehicles are at 65%, which is not a tier.
3. **Eligibility status was free-drifting** (`01`). Six options where roughly four were
   intended, including a stray `ou` fragment — on the field that decides whether a person
   may rent a car.
