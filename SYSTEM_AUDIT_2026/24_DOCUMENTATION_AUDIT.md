# 24 · DOCUMENTATION vs REALITY

**362 tracked markdown files in `docs/` alone** — comparable in volume to the entire source tree. Documentation is not this project's weakness; **currency** is.

## 🟢 Documentation that is accurate and valuable
| Doc | Why it is good |
|---|---|
| `docs/SCHEMA-DRIFT.md` (09-01) | Honest, quantified, names the `IF NOT EXISTS` trap and the missing-types root cause, ships a remedy script. **Model of a good engineering doc.** |
| `docs/BUSINESS-REQUIREMENTS-SPEC.md` v3 (09-01) | Reconciles DB + Drive + owner, tags every claim `[OWNER]`/`[DOC]`/`[DB]`/`[CONFLICT]`/`[OPEN]`, and **openly corrects its own v2** on insurance, deposits and pricing |
| `supabase/migrations/_parked/README.md` | Explains *why* three migrations must not be applied (split-brain) |
| Inline comment at `queries.ts:6-22` | Explains the fail-open read bug and its fix, in place |
| `do_not_contact_numbers` table comment | Documents that a missing SELECT policy makes the DNC gate **fail open** — "exactly how it was broken until 2026-07-16" |

## 🔴 DOCUMENTED BUT NOT BUILT
| Claim | Reality |
|---|---|
| Dispute engine | **9 tables absent from production**; UI exists |
| `lead_pool` system | Parked, never applied; `lib/lead-pool.ts` still calls it |
| E-signature, ID verification, accounting, telematics | Referenced in docs; **no code** |
| Insurance products / carrier "National Fleet Underwriters" | Seed rows only; **no policy in Drive** (already self-corrected in BRS v3) |
| Deposit policy | **Blank in every template** — the published table was seed data |

## 🟠 BUILT BUT NOT DOCUMENTED
- The **`OrgRowShapeError` failure mode** — the live cause of the lead outage, documented nowhere.
- **`.vercel/project.json` pointing at the wrong project.**
- The **`swarm-coord` deploy loop** and its 20 blocked deployments.
- Which of `fleet` vs `vehicles` (and `active_customers` vs `bookings`) is canonical — the most consequential undocumented decision in the schema.
- The duplicate `20260827000000` migration timestamp.

## 🔴 DOCUMENTATION THAT IS NOW WRONG
| Doc | Wrong claim | Truth |
|---|---|---|
| `BUSINESS-REQUIREMENTS-SPEC.md` §1.5 | Lead webhook 500s **935 times**, cause = missing env vars, **current** | **2,197** failures; **resolved 09-01T19:29:28Z**; replaced 41s later by `OrgRowShapeError` (184 more). **The stated cause is no longer the live cause.** |
| `SCHEMA-DRIFT.md` | 220 applied / ~39 in repo | 214 / 41 today — conclusion unchanged |

## 🟡 STALE
~12 docs untouched since 2026-06-04 including `ARCHITECTURE.md` and `DATABASE-SCHEMA.md` — i.e. **the two documents a new engineer would read first are three months old and predate 173 of the 214 applied migrations.**
`docs/archive/command-center-2026-05/` correctly quarantines superseded material.

## The pattern
This project documents **decisions** superbly and **live state** poorly. `SCHEMA-DRIFT.md` proves the team can write a first-rate status document; the gap is that nothing re-checks those documents against production. A status doc with no refresh mechanism becomes a confident, wrong answer — which is precisely what §1.5 is today.

**Recommendation:** delete or date-stamp `ARCHITECTURE.md` and `DATABASE-SCHEMA.md`, and put a "verified against production on <date>" line at the top of every live-state doc.
