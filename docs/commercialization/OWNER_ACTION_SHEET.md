# OWNER ACTION SHEET

**Ten decisions. No source code required. Answer in the blanks.**

Everything here is a choice only you can make. Nothing on this page needs an
engineer. Full evidence for each lives in `OWNER_DECISIONS.md` (20 decisions);
this sheet is only the ten that need no engineering.

Recommendations are **non-binding**. Where the repository cannot support a
recommendation, it says so rather than guessing.

---

### ☐ 1 · Which price list is authoritative? *(D-1)*

You have three, and they disagree. Your contracts point at the one your website
doesn't use.

**Recommended:** the shipped storefront (`/kits` + `/build`). It is public,
internally consistent, and its arithmetic checks out. OFFER-STACK becomes your
internal operating model, not the quoted authority.
**Alternatives:** OFFER-STACK wins · merge into one catalog later.
**Consequence:** every quote and contract points at one place.
**Unblocks:** items 5, all contracts, the merged catalog.

**Answer → ☐ Storefront ☐ OFFER-STACK ☐ Merge · _______________**

---

### ☐ 2 · Operator seat: $97/mo or $297/mo? *(D-2)*

**Both are live to the public right now**, on two pages of your own site.

**Recommended:** **$97/mo with 500 tokens.** Eight sources, your database and your
onboarding script all say $97. The $297 page also promises **2,000 tokens, and no
grant tag for that tier exists** — you would be selling something the system
cannot deliver as a distinct tier.
**Alternatives:** $297 (requires building the tier first) · both as two named tiers.
**Consequence:** one public price; the undeliverable promise comes down.
**Unblocks:** the operator seat as a sellable SKU.

**Answer → ☐ $97/500 ☐ $297/2000 ☐ Two tiers · _______________**

---

### ☐ 3 · Khan Strategies referral rate *(D-3)*

876 leads, consent capture already built, `commission_cents` sitting empty. **This
is your shortest path to a new dollar — no checkout, no code.**

**No recommendation on the number** — it is a negotiation with an independent
company and the repo cannot evidence what they will accept. The only written
anchor in your own files is **$50–$150 per referral** (an unbuilt backlog note).
**One thing the evidence does say:** pay on **completed**, not on referral-sent —
your own rule is "pays on real sales only".
**Structures to choose among:** fixed fee · % of collected revenue · % of first
contract · recurring % for a fixed term · hybrid.

**Answer → Structure: _____________ Amount: $______ / ______%  Trigger: ☐ completed ☐ other**

---

### ☐ 4 · Revenue share and royalty *(D-4)*

**No authoritative rate exists anywhere in your business.** Five incompatible
schemes are in the files, and **the only one that writes to your live database
(0% / 70% / 85% by stage) was never approved by you** and reverses the direction
of another.

**No recommendation on the number.** Two things need your decision regardless:
your public affiliate page promises **30% recurring** while your draft agreement
says **flat $35** — one is wrong and both face customers.

**Answer → Operator rev-share: ______%  Basis: ☐ gross collected ☐ net ☐ per-deal**
**Royalty: ______%  ·  Affiliate: ☐ 30% recurring ☐ flat $35 ☐ other ________**

---

### ☐ 5 · Which GHL products to create *(D-6)*

Your storefront is finished. Whether the payment links behind it exist is
**unverified** — I cannot read your Vercel values.

**Recommended:** create only the four SKUs of whichever list wins item 1 — Ops Kit,
Command Kit, Dealer Bundle, Operator seat — plus their three monthly counterparts.
**⚠️ Before you follow the runbook:** it tells you to name eight variables without
the `NEXT_PUBLIC_` prefix your code requires. **Follow it literally and every kit
checkout silently falls back to your generic site with no error shown.** Every
checkout variable must begin `NEXT_PUBLIC_`.
**Also:** the three monthly links (`..._OPS_MONTHLY`, `..._COMMAND_MONTHLY`,
`..._DEALER_MONTHLY`) are documented nowhere — your entire recurring line has no
written setup path.

**Answer → ☐ Four core SKUs ☐ All 17 ☐ Other: _______________**

---

### ☐ 6 · `dist/` — tracked artifact or generated output? *(D-7)*

**Recommended: keep it tracked; narrow the ignore rule.** It is a hand-made 23-file
operator kit that **nothing can regenerate**, and `FLEET-UP.sh` fails without it.
It was committed first and gitignored later by an unrelated tidy-up — the ignore
line is the mistake, not the tracking. No longer urgent: another session restored it.

**Answer → ☐ Keep tracked ☐ Untrack & generate ☐ Split**

---

### ☐ 7 · Founding-operator terms *(D-13)*

`OFFER-STACK.md` still names Muhammad Umar as a founding operator with "brain free
until $50K is collected", alongside Ayyan Khan. Your standing rule fences that
party entirely. **I have not edited it — it records a money obligation, and that is
yours to change, not mine.**

**Recommended:** keep the deferral structure, remove the named party. Separately,
revoke the unused install token on the inactive `seed-moe-legacy` licence row.

**Answer → ☐ Remove the name, keep structure ☐ Strike the row ☐ Leave as is**

---

### ☐ 8 · Agent production-write authority *(D-18)*

A document installed on your machine on 2026-09-07
(`docs/CONTROL-PLANE-OPERATING-SCRIPT.md` §3) records a standing grant — *"Fix and
do any and all tasks. You have my permission"* — and concludes that rehearsed work
may be applied to production **without asking you**. Every other rule you have
written says the opposite.

**Recommended: owner gate stays. Amend §3 so the document stops contradicting
itself.** Exact wording ready to paste:

> Standing authorization covers local analysis, rehearsal, testing, documentation
> and explicitly pre-approved non-production work. Production deploys, production
> writes, money movement, external sends, signatures and similarly consequential
> actions remain owner-gated unless the owner explicitly authorizes that specific
> class of action.

**Note:** no session is treating §3 as permission. Text in a file is evidence, not
authorization — it cannot widen an agent's authority, whatever it says.
**Alternative:** grant a named narrow class (e.g. additive, rehearsed, reversible
migrations) — but that requires you to write the class down *and* change the
enforcement hook; the words alone grant nothing.

**Answer → ☐ Owner gate stays; amend §3 ☐ Grant this named class: _______________**

---

### ☐ 9 · S3-05 reason-code taxonomy *(D-19)*

Business policy the decision contract is waiting on. Free text until you supply the
list.

**Answer → Codes: _________________________________________________**

---

### ☐ 10 · Where does the car sit? *(D-20)* — **HOLD until answered**

The only offer you have that includes a **physical vehicle**, and two of your own
sources place it **$10,000 apart**.

- Your **database** calls the $25,000 rung **"Box + Vehicle."**
- **OFFER-STACK** puts the car at **$35,000** and describes $25,000 as the
  *car-rental vertical* — software, no car.

And the decisive detail: in the database, the $25,000 row grants **exactly the same
six entitlements** as the $15,000 row. The $10,000 difference buys nothing the
system records — so whichever reading is right, that row is wrong.

**Recommended:** **unbundle the vehicle.** Sell software at the software price and
quote the car separately at cost-plus. Bundling a used vehicle into a software
price fixes your margin against a market you do not control, and your entitlement
system cannot represent a car anyway. *(Fallback: put the car at $35,000 and rename
the $25,000 row.)*

**Until you answer: quote no offer that names a vehicle.**

**Answer → ☐ Unbundle ☐ Car at $35k ☐ Car at $25k · _______________**

---

## After you answer

| You answer | Unblocks |
|---|---|
| 1, 5 | Every quote; the first checkout |
| 2 | A live public contradiction comes down |
| 3 | **876 leads — the fastest new dollar** |
| 4 | **Every signable contract** (all currently ship `[TBD]`) |
| 7, 8 | Governance cleanup |
| 6, 9 | Hygiene |
| 10 | **Unblocks any quote naming a vehicle — on hold until then** |

**Ten further decisions in `OWNER_DECISIONS.md` do need engineering** — they are
not on this page on purpose.

---

## One thing to hold on to

Your system has recorded **$9,510.57 of real revenue, ever** — 31 rental payments
between October 2025 and March 2026, largest single payment **$577**, none since.

That does not mean your prices are wrong. It means **no business has yet paid you
for software**, so every B2B price in your files is a proposal, not a proven
number. Decide them anyway — you cannot sell without them — but treat the first
three sales as price discovery rather than confirmation.
