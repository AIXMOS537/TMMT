# QUARANTINE — disputed legal theories

**Not ingested into the brain. Not wired into the letter generator.**

Recovered 2026-09-01 from the `g3` Google Drive letter library. The grounds that hold up were
extracted to the working corpus as `verified-fcra-grounds`. This file holds the remainder —
kept as a record of what was in the pack and why it was set aside, so nobody re-imports it
later thinking it was missed.

**Nothing here is deleted.** The source files are intact in the media vault. This is a
routing decision, not a censorship one.

I am not a lawyer and this is not legal advice. Each item below is flagged with the specific
reason it was not carried forward, so counsel can overrule any of it on the record.

---

## 1. The one that matters most

> *"Under penalty of perjury, I swear this account is false and misleading"*

Listed in the source as a **generic reason** for charge-offs, repossessions and collections —
i.e. applied regardless of whether the account is actually the consumer's.

**Why it is quarantined:** it puts a sworn statement in the client's name asserting a fact that
may not be true. If the account is genuinely theirs, the client — not the business — has made a
false sworn statement, in writing, to a federal-regulated entity. The exposure lands on the
person being helped.

It also directly contradicts the owner's own standing rule, recorded in `dispute-process-lawful.md`:

> *"If an item is accurate, current, and verifiable, it is NOT disputed. It is coached on."*

Both cannot be operative. The standing rule is the one that survives.

---

## 2. The social-security-number exclusion theory

> *"Under 15 U.S. Code 1681a(2)(B) Exclusions from a consumer Report… any credit transaction
> supposed to be excluded from a consumer credit report if a social security card was used in
> the transaction."*

**Why it is quarantined:** the exclusion at §1681a(d)(2)(A)(i) covers information solely as to
**transactions or experiences between the consumer and the entity making the report** — the
carve-out that lets a creditor share its own dealings without becoming a reporting agency. It
does not say that using an SSN removes a transaction from consumer reports. Read as written,
the theory would exclude essentially every credit account in existence, which is plainly not
what the statute does.

Circulates widely in template packs. Does not survive contact with the section.

---

## 3. Estoppel by silence

> *"…have not supplied proof under the doctrine of estoppel by silence Engelhardt v. Gravens
> (Mo) 281 SW 715 719 I may presume that no proof of the alleged debt nor therefore any such
> debt in fact exists."*

**Why it is quarantined:** a 1926 Missouri case that appears in credit-repair template packs
almost verbatim. It is not an FCRA or FDCPA authority, and silence from a bureau does not
create a presumption that a debt does not exist. Including it signals to the recipient that the
letter came from a template pack, which materially weakens every *good* ground in the same
letter.

That last point is worth keeping even if a lawyer disagrees with the first: **a strong dispute
is weakened by being bundled with a weak one.**

---

## 4. The finance-charge theory on auto loans

> *"Under 15 U.S Code 1605(a) If a Finance Charge was included which is the sum of all payments
> There Should be no late payments on this account"*

**Why it is quarantined:** §1605 is TILA's *definition* of a finance charge for disclosure
purposes. It does not convert a financed account into one that cannot be reported late.

---

## 5. FDCPA claims aimed at credit bureaus

Several source reasons direct §1692d (harassment), §1692j (deceptive forms), §1692e and
§1692g at the **credit reporting agencies**.

**Why it is quarantined:** the FDCPA governs **debt collectors**. A credit reporting agency is
not one. The claim is misdirected and invites a one-line dismissal that costs credibility on
the rest of the letter.

The same sections **are** correctly used against a collection agency, and are carried forward
in `verified-fcra-grounds` §4 on that basis.

---

## 6. Bankruptcy as a privacy violation

> *"This Account is in Violation Of 15 U.S Code 1681 a (4) Consumer Right to privacy this
> Bankruptcy shouldn't be on my credit/consumer report"*

Marked in the source as *"use this reason first unless directed other reasons for bankruptcy."*

**Why it is quarantined:** §1681(a)(4) is a congressional **findings and purpose** statement
about the need for fair and equitable reporting with respect to confidentiality. It is not an
operative prohibition. A bankruptcy is lawfully reportable for 10 years.

The same applies to the parallel child-support version of this reason.

---

## 7. The forgery framing against courts

The bankruptcy and child-support letters assert that a court listed as furnisher is *"forgery
of your name onto my credit report."*

**Why it is quarantined:** public records generally reach reports through third-party vendors
rather than direct court furnishing. That is a data-sourcing question, not forgery. Accusing a
court of forgery in writing is a poor position to take and an unnecessary one — the accurate
version of this ground (*is the furnisher correctly identified?*) is preserved in
`verified-fcra-grounds` under §1681e(b).

---

## 8. Asserting litigation that has not been filed

> *"I am a litigious consumer… and is in the process of taking legal action in this matter."*
> *"Under FDCPA I've filed a civil suit against this credit bureau and debt collector."*
> *"These items should be deleted immediately while in litigation per FCRA guidelines."*

**Why it is quarantined:** two problems. It states as fact that a suit has been filed, which is
false unless one has. And there is **no FCRA provision requiring deletion of items during
litigation** — the third sentence describes a rule that does not exist.

This is why `allowAutomaticLitigationThreat` defaults to `false` in the policy configuration.
A litigation threat is a legal position a person takes deliberately, with counsel. It is not a
template a system emits on round five.

---

## 9. Boilerplate emotional-damage claims

> *"Recently i did an investigation on my credit report which caused severe depression upon me"*

**Why it is quarantined:** inserted as fixed text in a template, it is an assertion about the
client's mental health made without their input, repeated identically across every client.
Where genuine, it belongs in a damages claim the client actually makes. As boilerplate it is
both untrue-by-default and a tell that the letter is mass-produced.

---

## 10. Blanket "not mine" on accounts that are

Several reasons apply *"Mistaken identity / does not belong to me"* and *"this account is false
and not mine"* as general-purpose text for charge-offs and collections.

**Why it is quarantined:** as a factual basis this is excellent — `not_mine` is a first-class
ground in the policy module. As **default boilerplate** applied to accounts the consumer does
hold, it is a false statement, and it is the single fastest way to have an entire dispute file
dismissed as frivolous under §1681i(3).

The distinction is the whole point: **the ground is real, the blanket application is not.**

---

## What was kept instead

`verified-fcra-grounds` carries forward: §1681i(5) reinvestigation · §1681e(b) maximum possible
accuracy · §1681i(5)(B) reinsertion without notice · §1681s-2 and §1692e(8) failure to notate ·
**§1681i(7) method of verification, with the full list of what to demand** · §1681b permissible
purpose for inquiries · §1692g validation against collectors · §1666B billing error where the
payment genuinely was on time · §1681c obsolescence · §1681c-2 identity theft blocks.

That is a complete, workable dispute practice. It does not need any of the above.

---

## If you disagree with any of this

Take this file to the attorney who reviews the CROA work. Each item names its specific reason,
so it can be argued individually rather than as a block. Anything counsel clears moves to the
verified file with a note recording who cleared it and when.
