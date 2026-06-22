# Retention & Revocation Policy — {{PERSON}}

> ⚠️ Draft, not legal advice — counsel must review. A written **retention +
> destruction schedule** is legally required for biometric data in several
> jurisdictions (e.g. Illinois **BIPA** mandates a public retention/destruction
> policy). This is also the **one-switch destroy** runbook when consent ends.

**Date:** {{DATE}}   **Person:** {{PERSON}}   **Program:** {{PROGRAM}}

## 1. What we hold
- **Source material:** the photos / videos / voice you provided.
- **Biometric data:** facial geometry/imagery, voiceprint.
- **Built artifacts:** voice model, avatar model, persona profile.
- **Consent records:** this kit (ID, consent, comp, disclosure).

## 2. Where it's held
- **Local, encrypted, owner-only** (NAS/GPU node) — never public cloud, never sold,
  reachable only over the private network. Access is logged + least-privilege.

## 3. How long (retention schedule)
- Held **only while the license/term is active** and needed for the agreed scope.
- **Default destruction trigger:** the **earliest** of —
  (a) you revoke consent, (b) {{RETENTION_PERIOD}} after the term ends, or
  (c) the purpose no longer applies.

## 4. Revocation — how to end it
- **You may revoke at any time in writing** (email/letter to {{CONTACT}}).
- On revocation, within **{{REVOCATION_DAYS}} days** we will:
  1. **Stop using** your digital self immediately.
  2. **Delete** biometric data + trained voice/avatar models + persona profile.
  3. **Retire** the persona from every surface in scope.
  4. **Confirm destruction** to you in writing.
- Consent records (this kit) may be kept **only** as long as needed to prove
  lawful handling, then destroyed.

## 5. The destroy runbook (operator steps — owner-only)
- [ ] Mark the persona **retired** on the network (remove from all surfaces).
- [ ] Delete models + biometrics from the NAS/GPU node **and all backups**
      (`docs/MEMORIAL-NAS.md` 3-2-1 copies — purge each, including offsite).
- [ ] Verify deletion (no residual copies on any node/snapshot beyond legal hold).
- [ ] Send the **written destruction confirmation**; log the date.

## 6. Acknowledged
Person: ________________________ ({{PERSON}})   Date: __________

Provider: ______________________ (TMMT / AIXMOS)   Date: __________

---
_This policy is referenced by `DIGITAL-LIKENESS-AND-BIOMETRIC-CONSENT.md` §2 & §6._
