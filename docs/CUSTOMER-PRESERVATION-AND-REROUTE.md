# Keeping Every Customer — and Where They Go Next

**2026-09-01** · Owner instruction: *"never want to lose a customer of any kind, but reroute them to other things as well."*

---

## 1. The apparent conflict, and why there isn't one

Two instructions look like they fight:

- **Retention policy:** stop holding data you no longer need.
- **You:** never lose a customer.

They don't fight, because **a customer is not a document.**

| Keep — this is the asset | Delete — this is the liability |
|---|---|
| Name, phone, email | Driver's licence scan |
| How they found you | Paystub |
| What they asked for | Background-check screenshot |
| What happened, and why | Proof of insurance |
| Whether they may be contacted | Extracted report details |
| Notes and history | |

> **You keep the person. You do not keep their paperwork.**

Deleting a driver's licence loses you nothing commercially — you were never going to sell to a JPEG. Deleting the phone number would lose you the customer. **The retention plan only ever proposed deleting the second column.** Nothing in it touches the relationship.

This is also the blueprint's own rule, from `01-BUSINESS-BLUEPRINT.md` §10: *"A person who does not qualify today is not a dead lead. Never delete, never discard."* That still holds. It always did.

---

## 2. Who you actually have

Verified live, 2026-09-01.

| Group | Count | What it is |
|---|---:|---|
| **Reachable people** | **1,089** | Distinct 10-digit phone numbers across all three stores. **This is the real audience number** — not 3,726 rows, not 875 leads |
| GHL contacts | 1,642 | Rows, with duplicates |
| Incoming leads | 875 | 662 bulk-imported on one day + 213 real |
| Waitlist | 104 | **Asked for a car and never got one.** The warmest list you have |
| Background checks on file | 299 | People who went far enough to be screened |
| Active customers (June snapshot) | 35 | 16 active / 19 removed at the freeze |
| Operator profiles | 19 | Against a 100 cap |
| On the do-not-rent list | 12 | Excluded from rentals — not necessarily from everything |
| **Opted out of contact** | **10** | The TCPA gate |

Nothing here has been deleted, and nothing in any plan proposes deleting it.

---

## 3. 🔴 The problem with rerouting, stated honestly

**`opted_out` is `false` on all 875 leads. The do-not-contact list has 10 numbers, against 1,089 reachable people.**

That is **not** evidence that 1,079 people agreed to be contacted. It is evidence that **consent was never recorded either way.**

Under TCPA the burden sits on the sender to *prove* consent. **Absence of an opt-out is not consent.** And there is a second layer: someone who gave their number to ask about renting a car consented to a conversation about renting a car. That is not automatically consent to be pitched credit repair.

Two more facts that bear on this:

- The opt-out gate **previously failed open** — it returned zero rows, which reads as "nobody opted out" — until it was fixed on 2026-07-16. There is still **no regression test** asserting it fails closed.
- Many of these people last heard from TMMT **months ago**, about a service that no longer exists.

**So: preserve all 1,089. Contact none of them until §5 is done.** Preservation and outreach are different decisions, and only the first one is free.

---

## 4. Where people could go — safest first

You already own the destinations. Ranked by how defensible the reroute is, not by how much it might earn.

### 🟢 Tier 1 — Your other service businesses

**TMMT Detailing · TMMT XPRESS · TMMT Moving & Cleaning.** All three already have live GoHighLevel sub-accounts.

This is the **best** reroute and it is not close:

- Ordinary consumer services. **No CROA, no FCRA, no insurance regulation.**
- The pitch is honest and easy: *"we're not renting right now, but we do detailing in the same area."*
- Same geography, same kind of customer.
- Nothing to build — the sub-accounts exist.

**Best-fit groups:** the 104 waitlist, the 35 former renters, anyone declined on `out of radius` who is still local for a mobile service.

### 🟡 Tier 2 — Operator programme

19 profiles against a 100 cap, 15 training modules already built.

Fits people who wanted to *earn* with a vehicle rather than rent one — and it is the direction `BUSINESS-MODEL.md` already points ("scale licensed operators who pay upfront"). Higher-commitment, so a smaller and more selective list.

⚠️ Gate: the resale ladder runs to $35–50k. Selling a business opportunity carries its own disclosure rules. Have those reviewed before any pitch goes out.

### 🔴 Tier 3 — Credit and funding · **do not route here yet**

The natural instinct is to send the 24 people declined on their background check into credit repair. **That is the single most dangerous move available**, and it needs saying plainly:

1. **There is no active credit partner.** The only `partners` row is deactivated, marked *"do not re-enable."*
2. **The provider would be All In One Management LLC — your own company.** That is related-party, not a referral, and it changes what may be said.
3. **CROA governs fee timing, disclosures and cancellation rights.** The existing products ($97/mo · $250 + $250 · $1,000 DFY) collect before performance.
4. **Routing someone from a credit-based denial straight into a paid credit product is exactly the pattern regulators look at.**
5. The marketing that promised *"$800–$1,000/month on autopilot"* and *"$50K+ in funding"* came from this pathway. That file is now archived — **do not let the offer follow the copy back out.**

`[BLOCKED]` — needs an active partner, counsel sign-off on fee timing and disclosures, and the adverse-action question in `ADVERSE-ACTION-PROCESS.md` answered first.

### ⬛ Tier 4 — People to leave alone

| Group | Count | |
|---|---:|---|
| Opted out | 10 | **Never contact. Ever.** Keep this record forever |
| Do-not-rent list | 12 | Excluded from rentals. `[OPEN]` whether they should hear about anything else |
| No phone and no email | 466 rows | Cannot be contacted and cannot be identified. Quarantine, don't guess |

---

## 5. Before a single message goes out

In order. None of it is optional, and none of it is expensive.

| # | Step | Why |
|---|---|---|
| 1 | **Write a regression test asserting the opt-out gate fails closed** | It once failed open. Until a test proves otherwise, every send is a guess |
| 2 | **Record consent per person, per channel, with a source and a date** | Right now the system cannot tell you who agreed to what. That field does not exist |
| 3 | **Segment by what they actually asked for** | Rental enquiry ≠ permission to pitch credit |
| 4 | **Write the copy for Tier 1 only**, and have it reviewed | No guarantees, no income claims, no implying the rental business is running |
| 5 | **Include a working opt-out in every message**, and honour it in one place | The do-not-contact list is the master |
| 6 | **Start small** — 20 people, see what happens | 1,089 messages after a 76-day silence is how a number gets flagged |

---

## 6. What is being built to preserve all of it

| Tool | Captures | Status |
|---|---|---|
| `scripts/export-airtable-full.mjs` | Every table, every field, every relationship, every record. **How Airtable works**, so it survives the switch-off | ✅ Built, read-only |
| `scripts/export-pii-archive.mjs` | The 810 attached documents, separately | ✅ Built, read-only |
| `docs/DATA-RETENTION-POLICY.md` | What is kept, what is deleted, when | ✅ Drafted, awaiting counsel |
| Supabase | Already holds the contacts. RLS verified holding | ✅ Live |

Run the structure export first — it writes no customer data at all:

```bash
node scripts/export-airtable-full.mjs
```

⚠️ You need a **fresh Airtable token**; the old one returns 401.

---

## 7. The short version

1. **Nobody is being deleted.** 1,089 people are preserved, plus every table, field and relationship in Airtable.
2. **Documents go, people stay.** Licences and paystubs are a liability with no commercial value. Phone numbers are the asset.
3. **The safest reroute is your own detailing, moving and cleaning businesses.** Same customers, same area, no regulated products, sub-accounts already live.
4. **Credit and funding stays closed** until there is a partner, counsel sign-off, and the FCRA question answered.
5. **Consent is the blocker, not the list.** You have 1,089 numbers and proof of permission for almost none of them. That is fixable — but it is fixed *before* the first send, not after.
