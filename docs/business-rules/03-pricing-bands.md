# 3. Pricing bands

Source: Fleet (`tblubnSDZkvsc9L6I`), 43 vehicles. Read live 2026-09-15.

---

## 3.1 The six bands

`Weekly Prices` (`fldnVDKCLlkblAhbW`): `300` · `350` · `400` · `450` · `500` · `550`

**Rule:** each vehicle is priced into one or more $50-step weekly bands from $300 to $550.
**Encoded in:** a `multipleSelects` field — **not** a single select, and not a number.

> **The field type is itself a finding.** `multipleSelects` means a vehicle can carry *several*
> bands at once. Supabase stores it as an `ARRAY` (VERIFIED: `weekly_prices` is `ARRAY`). So
> "the price" of a vehicle is not a scalar and never was. Any client-facing quote engine that
> assumes one price per vehicle will misread this data.

**Consistently enforced?** **UNKNOWN** — the distribution of bands per vehicle was not counted.
`scripts/parity-check.ts --table fleet --sample 5 --fields` will show it.

**Disposition: DECISION REQUIRED.** Is multi-band intentional (seasonal / term-length pricing)
or an artefact of a convenient field type? The answer determines whether the product models
price as a scalar, a range, or a rate table.

---

## 3.2 What determines a vehicle's band

**Nothing encoded. VERIFIED** — there is no formula on `Weekly Prices`, and no field links
vehicle attributes to a band. The base carries `Year`, `Vehicle Make`, `Vehicle Model`,
`Mileage`, and `Type` (Sedan · SUV · Compact/Hatchback · Pickup Truck · Minivan · Crossover ·
Electric/Hybrid) — but none of them drives the price.

**Consistently enforced?** **No rule existed to enforce.** Banding was a judgement call.

**Disposition: DECISION REQUIRED — this is a core productization gap.** A fleet OS sold at
$4,000–$8,500 is expected to answer "what should I charge for this car". The owner's pricing
judgement is exactly the expertise the product is meant to encode (`CLAUDE.md`: *"Ship first —
the owner is the expert"*). It needs to be stated as a rule: which attributes map to which band.

---

## 3.3 `Lowest Possible Price` — a prompt, not a policy

`Lowest Possible Price` (`fldXsPQANzSKJVXTv`), type `number`. Its field description reads:

> *"Remember, you are a member of this business and you will be the first point of contact with
> this vehicle. Based on your prior knowledge and what you know about TMMT Rentals, what is your
> personal opinion on what the lowest possible price we can charge the customer."*

**That is an LLM prompt sitting in a field description on a `number` column.** The floor price
— the number that bounds every discount — was populated by asking a model for its "personal
opinion", per vehicle.

**Consistently enforced?** **No.** A per-vehicle generated opinion is not a discount policy.

**Disposition: DECISION REQUIRED — recommend DROP and replace.** A discount floor must be a
deterministic rule (a percentage off band, or a per-vehicle cost-based floor). It must not ship
to a tenant as a model's opinion. Storage is `numeric` (VERIFIED), so precision is intact and
existing values are salvageable as a starting point for a real floor.

---

## 3.4 Discount authority

**Not encoded anywhere. VERIFIED** — no approver field, no discount-reason field, no audit of
who priced below band.

The plan asks "what authority exists to discount". The answer is: **none was recorded.**

**Disposition: BUSINESS POLICY REQUIRED.** For a multi-tenant product, discount authority is a
per-role permission and belongs in the owner-approval gate (`shared/owner-approval-gate/`),
since discounting is a financial action.
