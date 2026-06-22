# Digitization Consent Kit — the Layer-0 gate (draft for your attorney)

> ⚠️ **These are DRAFTS, not legal advice.** A licensed attorney in your state /
> the member's state must review and finalize before you use them. They're written
> to get you ~80% there so counsel reviews instead of drafts from scratch. Biometric
> and likeness law varies by jurisdiction (e.g. Illinois **BIPA**, Texas CUBI,
> Washington, EU **GDPR/AI Act**) and carries real penalties — do not skip review.

## What this kit gates

No person is scanned, and no avatar/voice/persona is built, until **all** of these
are complete and on file for that person. Enforce it like the secret-guard: no
exceptions, no "we'll paper it later." Applies to both:
- **Join the Verse** (`docs/JOIN-THE-VERSE.md`) — paid self-digitization.
- **Digital Ambassadors** (`docs/DIGITAL-AMBASSADORS.md`) — licensed talent.

## The documents (complete in this order)

1. **`ID-AGE-VERIFICATION-RECORD.md`** — prove they're a consenting adult. First.
2. **`DIGITAL-LIKENESS-AND-BIOMETRIC-CONSENT.md`** — the core release: likeness +
   biometric capture, purpose, scope, term, territory, **no-explicit**, revocation.
3. **`COMPENSATION-SCHEDULE.md`** — what they pay (to join) and/or are paid (talent).
4. **`AI-DISCLOSURE.md`** — they acknowledge it's an AI persona + the disclosure
   shown to anyone it interacts with.
5. **`RETENTION-AND-REVOCATION.md`** — how long data is kept and the one-switch
   destroy path when consent ends.

## Where signed copies live
- **Owner-local + encrypted**, never in git: store under `.hailmary/deals/<person>/`
  or `.memorial/`-style gitignored space. IDs and biometrics follow vault rules.
- A simple status line per person: `gates: ID✓ consent✓ comp✓ disclosure✓ retention✓`.

## The bright lines (baked into every doc, never waived)
- Verified **adult** only — no minors, ever.
- **Opt-in only** — self-likeness or signed consent; never a non-consenting third party.
- **No explicit / intimate** likenesses. **No impersonation / deception.**
- **Revocable** — withdrawal destroys models + biometrics and retires the persona.
- **Disclosed** — always presented as an AI persona.

_Companions: `docs/JOIN-THE-VERSE.md`, `docs/DIGITAL-AMBASSADORS.md`,
`docs/MEMORIAL-NAS.md` (storage posture), `docs/deal-kit/README.md` (the wider kit)._
