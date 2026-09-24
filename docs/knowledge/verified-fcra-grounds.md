# Verified FCRA / FDCPA dispute grounds

Recovered 2026-09-01 from the owner's `g3` Google Drive letter library, then screened.
**This file holds only the grounds that rest on a correct reading of the statute.**

Grounds that rely on contested or misread legal theories are held separately in
`disputed-legal-theories.md` and are **not** part of the working corpus. Two source letters
containing real client account data were quarantined and are not represented here.

Every ground below is still subject to the standing rule:

> **If an item is accurate, current, and verifiable, it is NOT disputed. It is coached on
> (behaviour + time). Document for each item: bureau(s), creditor, the specific factual reason.**

A statutory citation is not a reason to dispute. It is the *route* once a factual reason exists.

---

## 1. Reinvestigation and accuracy — the core grounds

### §1681i(5)(A) — delete or modify after reinvestigation

If, after reinvestigation, an item is **inaccurate, incomplete, or cannot be verified**, the
agency *shall* promptly delete or modify it, and notify the furnisher.

This is the backbone of the ordinary dispute. It is what makes "unverifiable" a real outcome
rather than a rhetorical one.

### §1681e(b) — maximum possible accuracy

> *"Whenever a consumer reporting agency prepares a consumer report it shall follow reasonable
> procedures to assure maximum possible accuracy of the information concerning the individual
> about whom the report relates."*

Pairs with §1681i(5). Used when the item is demonstrably wrong on a specific field —
balance, dates, status, payment history — not as a general complaint.

### §1681i(5)(B)(ii)-(iii) — reinsertion without notice

An item that was **deleted and then reinserted** must be notified to the consumer within
5 business days. Reinsertion without that notice is a violation in its own right.

Strong ground, easy to evidence, frequently missed.

### §1681s-2 — furnisher responsibilities: failure to notate a dispute

Where a furnisher fails to mark an account as disputed within 30 days, that is a furnisher
violation. Aim it at the **furnisher**, not the bureau.

For a **collection** account the equivalent route is **§1692e(8)** — communicating credit
information known to be disputed without disclosing that it is disputed.

> Note the distinction, because it is the one most often got wrong: **§1681 governs credit
> reporting agencies and furnishers. §1692 (FDCPA) governs debt collectors.** A collection
> agency is both. A credit bureau is neither.

---

## 2. Method of verification — §1681i(7)

The single most useful escalation, and the letter in this library is correct.

Where an item comes back "verified", the consumer may require a **description of the
reinvestigation procedure**, to be provided within 15 days of the request.

**What to demand, specifically:**

- the name of the original creditor
- the creditor's address and telephone number
- **the name of the person who verified the dispute**
- the documentation and original contracts used to validate it
- the procedures the agency has in place to ensure accuracy

The value is practical, not rhetorical: an agency that "verified" an item through an automated
e-OSCAR code match often cannot answer these questions, and the item then falls under
§1681i(5)(A) as unverifiable. **This is why MOV belongs immediately after a verified result,
not later in a sequence.**

---

## 3. Inquiries — §1681b permissible purpose

A consumer report may be furnished only in the circumstances §1681b lists, including
**"in accordance with the written instructions of the consumer to whom it relates."**

§1681b(a)(3)/(c) further restricts furnishing a record of inquiries in connection with a
transaction **not initiated by the consumer**.

Correct ground for an inquiry the consumer genuinely did not authorise.

⚠️ **Scope discipline:** this is a strong ground for *inquiries*. Extending "I never gave
written consent" to every tradeline on a report is a different claim, and a much weaker one —
an account the consumer opened carries its own permissible purpose. See
`disputed-legal-theories.md`.

---

## 4. Collections — validation under §1692g

Within 5 days of initial communication a debt collector must provide written notice of the
debt and the right to dispute it. On timely dispute the collector must **cease collection
until it verifies the debt**.

Practical form used in this library: request proof of the alleged debt, specifically the
**original application bearing the consumer's signature**. Where the collector cannot produce
it and continues reporting, that is the ground.

Related, correctly applied to collectors only:

- **§1692e** — false or misleading representations
- **§1692f** — unfair practices
- **§1692j** — furnishing deceptive forms

---

## 5. Late payments — §1666B billing error

A billing-error claim under the Fair Credit Billing Act where a payment was **made on time
and reported late**.

⚠️ This is a genuine ground **only where the payment was actually on time.** Used as a blanket
reason against any late payment it is simply a false statement of fact, and it fails.

---

## 6. Medical collections

Medical debt carries additional restrictions on what may be reported and when. The specific
citation in the source library is not the right one, so the ground is stated here without it:
**medical collections are subject to their own reporting limits and should be checked against
current bureau policy and the applicable rules before disputing on that basis.**

`[OPEN]` — confirm the current citation and threshold with counsel before this ground is used.

---

## 7. Obsolescence — §1681c reporting periods

Most adverse items: **7 years.** Chapter 7 bankruptcy: **10 years.** Inquiries: **2 years.**

An accurate item reported past its period is still a violation. **This is the one ground where
accuracy is irrelevant** — which is why the policy gate checks obsolescence *before* it checks
accuracy.

---

## 8. Identity theft — §1681c-2, §605B

Where an item results from identity theft and the consumer provides an identity theft report,
the agency must **block** the information within 4 business days.

This is a distinct statutory path with its own evidence requirement. It is not a synonym for
"not mine" — it requires an actual identity theft report.

---

## 9. Sequencing, as the grounds imply it

Not a fixed campaign. The ground determines the route.

| Situation | Route |
|---|---|
| Item past its reporting period | §1681c obsolescence. One letter. Escalate only if ignored |
| Specific field is wrong | §1681e(b) + §1681i(5) to the bureau, then §1681s-2 to the furnisher |
| Came back "verified" | **§1681i(7) method of verification** — demand the procedure |
| MOV unanswered or inadequate | §1681i(5)(A) — unverifiable, must be deleted |
| Collection account | **§1692g validation first** — cheapest win, and it stops collection |
| Unauthorised inquiry | §1681b permissible purpose |
| Deleted then reappeared | §1681i(5)(B) reinsertion without notice |
| Identity theft with a report | §1681c-2 block, 4 business days |

**Bureau first, then furnisher.** The bureau has the reinvestigation duty; the furnisher has
the accuracy duty. Sending both at once wastes the second letter.

---

## 10. What the letters get right structurally

- **One ground per item**, stated with its citation, rather than a scattergun of every statute.
- **The item is identified** — creditor, account reference, bureau — so the dispute is specific.
- **A demand and a deadline**, not a request.
- Merge fields throughout (`{client_first_name}`, `{bureau_name}`, `{dispute_item_and_explanation}`),
  so the letter is generated per item rather than hand-edited — which is what makes an engine
  possible at all.
