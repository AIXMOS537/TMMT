# 4. Partner economics

Sources: Fleet (`tblubnSDZkvsc9L6I`) `Partner Percentage`; Partner Acquisition
(`tblDL6VOeRmjddRNX`) formulas and `Deal Tier`. Read live 2026-09-15.

**This is the highest-stakes document in the set.** The plan names partner churn as the
mechanism by which the original business failed, and opacity as its cause.

---

## 4.1 The headline finding — the split was mostly never recorded

VERIFIED by direct query against `public.fleet` (43 vehicles):

| `partner_percentage` | Vehicles |
|---|---:|
| **NULL** | **36** |
| 0.70 | 4 |
| 0.65 | 2 |
| 0.60 | 1 |

**36 of 43 vehicles — 84% of the fleet — have no partner percentage recorded at all.**

The plan states "values on file: 0.60, 0.65, 0.70". That is accurate, and it describes
**7 vehicles**. The other 36 had no machine-readable revenue split.

**Consistently enforced?** **No — and this is the most consequential "not consistently
enforced" finding in the entire base.** The commercial term that determines what each partner
is paid was, for the large majority of the fleet, not written down in the system of record.

Partner opacity was the cause of churn. The data shows why it was opaque: **there was nothing
to be transparent with.** A partner earnings view (Phase 6 §8.1) cannot be built over 36 NULLs.

**Disposition: DECISION REQUIRED — and it is a data-recovery task, not just a schema decision.**
The owner must supply the actual split for each of the 36 vehicles from contracts, messages or
memory, or mark them explicitly as "no partner / company-owned". **Do not default NULL to a
percentage.** Inventing a revenue split is the clearest possible violation of Prime Directive 5,
and it would silently misstate what a partner is owed.

---

## 4.2 The going-forward tier model

`Deal Tier` (`flde4ZxiBaBLD4cpe`) on Partner Acquisition — VERIFIED, with TMMT's obligation
stated in each option name:

| Tier | Split (owner/TMMT) | What TMMT carries |
|---|---|---|
| Tier 1 | **70 / 30** | Owner carries insurance + maintenance |
| Tier 2 | **60 / 40** | TMMT carries insurance **OR** maintenance |
| Tier 3 | **50 / 50** | TMMT carries insurance + maintenance + payout floor |
| Legacy | grandfathered | — |

The field description states the governing principle explicitly:

> *"The split is earned, not asked for. Tier is set by WHAT TMMT CARRIES on that vehicle. Never
> offer a richer TMMT share without moving cost onto TMMT's side of the line."*

**This is a genuine, well-formed business rule** — the clearest one in the base. It ties the
split to an obligation rather than to negotiation.

### CONFLICT — the tier model does not cover the live data

The tiers are 70/30, 60/40, 50/50. **Two live vehicles sit at 0.65, which is not a tier.** One
sits at 0.60 (Tier 2) and four at 0.70 (Tier 1).

**Disposition: DECISION REQUIRED.** Are the 0.65 vehicles `Legacy – grandfathered`, or does a
65/35 tier need to exist? Until answered, any migration that maps historical percentages onto
tiers will either drop or misclassify those two vehicles.

---

## 4.3 The payout formulas — VERIFIED, and they are correct

Read directly from the field config:

| Field | Formula |
|---|---|
| `Owner Payout / Week` | `{Target Weekly Rate} * {Proposed Partner %}` |
| `TMMT Gross / Week` | `{Target Weekly Rate} * (1 - {Proposed Partner %})` |
| `Owner Net After Note / Month` | `IF({Rate}, ({Rate} * {Partner %} * 4.33) - IF({Monthly Note}, {Monthly Note}, 0))` |

`4.33` is the weeks-per-month constant. The arithmetic is sound and the null-handling on the
car note is correct.

**`TMMT Gross / Week` carries an honest description** that should survive into the product:

> *"TMMT's gross share per week at full occupancy. Before insurance, maintenance, claims,
> downtime and ops cost — this is NOT profit."*

And `Owner Net After Note / Month`:

> *"If this is near zero or negative, the partner quits in month 2 — do not onboard on those
> terms."*

**This is the churn rule, stated plainly by the business and encoded in arithmetic.** It is the
single most valuable rule to carry forward. **Note it is advisory, not enforced** — nothing
blocks onboarding a partner whose net is negative.

**Disposition: DECISION REQUIRED — recommend CARRY FORWARD and make it a hard gate,** since
the business already knows it predicts churn. The threshold (near zero = what, exactly?) is
**BUSINESS POLICY REQUIRED**.

> **All three formulas assume full occupancy.** None models downtime. A partner-facing earnings
> view built on them will overstate expected income — which is precisely the expectation gap
> that produces churn. Phase 6's partner earnings view must use *actual* collected revenue.

---

## 4.4 The onboarding gate — VERIFIED as internally sound

`⚠️ Gate Check` (`fldTvOKWnkeYtUwja`), described as *"Hard stops before a car can go live.
Must read CLEAR."*

```
IF(AND({Commercial Use Cleared} = "Yes – Verified",
       {Title in Owner's Name},
       {Finance Status} != "Leased",
       {Finance Status} != "Unknown"),
   "CLEAR",
   CONCATENATE(IF({Commercial Use Cleared} != "Yes – Verified", "INSURANCE ", ""),
               IF(NOT({Title in Owner's Name}), "TITLE ", ""),
               IF(OR({Finance Status} = "Leased", {Finance Status} = "Unknown"), "FINANCE ", "")))
```

Three hard stops: commercial-use insurance verified, title in the owner's name, and the vehicle
neither leased nor of unknown finance status. It names which gate failed rather than just
failing.

**Checked for the silent-failure pattern and it is clean:** `Finance Status` on Partner
Acquisition does carry `Leased` and `Unknown` options (VERIFIED), so the finance branch can
actually fire. (Fleet's own `Finance Status` has only `Paid Off` / `Financed` — a different
field with a different vocabulary, worth noting for any migration that tries to merge them.)

The `Commercial Use Cleared` description states the reasoning:

> *"CRITICAL GATE. A personal auto policy generally voids the moment the car is rented for
> money. Do not onboard until this is resolved."*

> ⚠️ **DEFECT FOUND WHILE PORTING (2026-09-16) — a blank Finance Status passes the gate.**
> In Airtable, `{Blank} != "Leased"` is TRUE and `{Blank} != "Unknown"` is TRUE, so a vehicle
> whose Finance Status was never filled in reads **CLEAR** — on a gate whose stated purpose is a
> hard stop — and the blocker branch never flags it either. The port in
> `src/lib/rules/partner-economics.ts` reproduces this faithfully and raises a
> `fidelityWarning`, with a test pinning the behaviour. **Whether blank should block is
> BUSINESS POLICY REQUIRED.** Reported, not silently fixed.

**Consistently enforced?** **Unenforceable in practice — the table holds 0 records.** The gate
is well-built and has never run on real data. It postdates the operating business.

**Disposition: DECISION REQUIRED — recommend CARRY FORWARD as a hard gate.** It is the best
piece of encoded compliance logic in the base. Note it must be re-implemented as real
validation: an Airtable formula that displays `"INSURANCE TITLE"` blocks nothing on its own.
