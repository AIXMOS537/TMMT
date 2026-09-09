# FIRST SALE CHECKLIST

**One offer, taken from lead to cash, with every step rated on what actually
exists today.**

Audit date: 2026-09-07 · Nothing here was built, changed or sent.

---

## THE OFFER

### Rentals back-office — done-for-you implementation

A small independent vehicle-rental or buy-here-pay-here operator gets the desk you
already run your own business on: fleet, customers, tickets, payments, insurance,
maintenance, background checks, and an owner dashboard — stood up, populated and
handed over.

**Why this one, on evidence and nothing else:**

- **It is the only asset with operational history.** 43 vehicles, 308 tickets, 299
  background checks, 35 active customers, 24 insurance records — and 31 real
  customer payments through it. Everything else in the portfolio has zero
  production usage. Dispatch has literally never recorded an incident.
- **You are the reference customer.** You ran a rental business on this. That is a
  demo nobody can argue with, and a story no competitor of your size has.
- **It needs no checkout, no GHL product, no code and no deployment.** Invoice,
  deposit, deliver. The deposit structure is already encoded (`high-ticket.ts`).
- **Manual fulfilment is not a defect here.** For a done-for-you implementation,
  hands-on delivery is the product. That is exactly why this beats the $97 seat as
  a first sale — a self-serve SKU with manual onboarding is broken; a service with
  manual onboarding is normal.

### Buyer profile

Independent rental / BHPH operator, **3–30 vehicles**, currently running on
spreadsheets, a notebook and text messages. Owner-operated. Feels the pain as
"I don't know what's on the lot without calling someone."

**Channel:** your own network and the 876 leads already in the database — you have
been in this industry and in this market. Not cold outbound.

### Price

| Basis | Figure | Status |
|---|---|---|
| **Demonstrated revenue** | $9,510.57 lifetime, largest payment $577 | **Consumer rental payments.** A different market from B2B software — it does **not** cap what a business will pay, but it is the only revenue you can prove. |
| **Existing list price** | **$15,000** (`high-ticket.ts:88-95`, deposit $7,500) | `VERIFIED EXISTING PRICE` — written in shipped code |
| **Proposed selling price** | $15,000, or a **$3,750–$7,500 pilot** for the first two customers | `PROPOSED — NOT A CURRENT COMMERCIAL TERM` |
| **Market-supported price** | **NOT YET ESTABLISHED** | No external comparables gathered. That is the next phase, deliberately not done here. |

**No business has ever paid you for software.** Treat the first two sales as price
discovery. A lower pilot price bought with a case-study right is worth more right
now than a full-price deal you cannot close.

---

## THE PIPELINE

| # | Stage | Status | What exists | What is missing |
|---|---|---|---|---|
| 1 | **LEAD** | 🟢 | 876 leads in `incoming_leads`; 19 public forms; `/forms/lead-intake` live and writing | Nothing. Note flow has collapsed to ~1/month — this is a stock to work, not a tap. |
| 2 | **QUALIFICATION** | 🟢 | Admin pipeline, lead pool with claim/assign, routing rules over all 876 | Nothing blocking. A 5-question fit script would help; not required. |
| 3 | **QUOTE** | 🟡 | Price exists in shipped code ($15,000 / $7,500 deposit) | **Decision 1** — which price list governs. Until then two documents quote differently. |
| 4 | **CONTRACT** | 🔴 | Six deal-kit documents drafted: engagement letter, payment schedule, platform licence, remote-access consent | **`{{REV_SHARE_PCT}}` resolves to `[TBD]` and `{{ROYALTY}}` is never filled.** Also grace, cure, notice, liability, venue, territory. **No instrument is signable today.** → Decisions 4 and 5. |
| 5 | **PAYMENT** | 🟡 | Deposit rule encoded (50% = GO). Money is taken in GoHighLevel, not in the app. | For a $15k invoice you do **not** need the checkout work at all — invoice + bank/ACH is fine. Checkout only matters for the self-serve SKUs. **This is why this offer beats the kits as a first sale.** |
| 6 | **FULFILMENT** | 🟡 | 27 working screens on real data; 11-step provisioning runbook with owner assignments and a go-live quality gate | **Entirely manual, and never run once** — `handoffs/` has never been created. Acceptable for a service; budget 2–4 days of your time. |
| 7 | **HANDOFF** | 🟡 | `provision-dealer-instance.mjs --apply` generates `OPERATOR-START-HERE.md` and a CSV work queue | Never executed. **Do a dry run against a fake dealer before you sell**, not after. |
| 8 | **SUPPORT / UPSELL** | 🟡 | Monthly retainer tiers exist on paper; Command Centre and Dispatch are natural attaches | Retainer price depends on Decision 1. Do not attach Dispatch as a paid line — it has zero production history. |

**Nothing is RED except the contract.** That single blocker is two owner decisions,
not engineering.

---

## THE SHORTEST PATH TO CASH

Ordered by dependency. Nothing here requires an engineer.

1. **Answer Decision 1** (price authority) — minutes.
2. **Answer Decisions 4 and 5** (rev-share, contract values) — the only true
   blocker. Route liability/venue/retention to counsel; set the commercial ones
   yourself.
3. **Dry-run the provisioning runbook once** against a fake dealer. Half a day.
   Find the gaps on your own time, not a customer's.
4. **Pick 10 names** from the 876 leads who own or run rental operations.
5. **Sell one at pilot price with a case-study right.**

**In parallel, and faster:** answer **Decision 3** (Khan Strategies rate) and start
working the 876 leads for referral income. That path needs no contract, no
checkout, no provisioning and no deployment — **it is the first new dollar, even
though it is not the first sale.**

---

## WHAT MUST NOT BE SAID WHILE SELLING THIS

Full table in `CLAIMS_AUDIT.md`. The four that would matter most in a rentals
pitch:

- ❌ **"Automated onboarding" / "instant provisioning."** Fulfilment is manual at
  every step and has never been run end to end.
- ❌ **"Enterprise-grade licensing with Secure Enclave attestation."** The key is
  stored and never verified; the kill switch is advisory.
- ❌ **Any credit-repair capability.** All seven legal gates are closed. Software
  and referral only.
- ❌ **"Owner approval is enforced on every payout."** It is documented, not
  implemented. *(Mitigator: no code in the repo moves money, so nothing is
  currently at risk — but do not claim the control.)*

✅ **Safe and true:** "Row-level security is enabled on every table in the
database, with 344 policies." "It is multi-tenant — 96 of 165 tables are
tenant-scoped." "I ran my own rental company on this."
