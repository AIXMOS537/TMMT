# Moe handoff — comms and prep

Everything you need to onboard Moe cleanly.

## Files

- `01-pre-install-call-script.md` — 12-15 min phone call BEFORE shipping USB.
  Explains the system, gets verbal acceptance, shares recovery phrase OOB.
- `02-install-day-call-script.md` — 20-25 min phone call DURING install.
  Walks through each step, includes contingency plays for common errors.
- `03-shipping-email-template.md` — written summary sent after pre-install
  call, after USB is in the mail. Sets expectations for the install call.

## Sequence

```
Day 0  — Pre-install call (script 01) + Burn USB + Ship USB
            ↓
            (1-3 day mail transit)
            ↓
Day N  — Moe reads /legal/ on the USB
            ↓
            (Moe emails "Read, ready to sign")
            ↓
Day N+ — Install call scheduled
            ↓
Day N+ — Install call (script 02) + first heartbeat verified
            ↓
            Partnership is live
```

## What's deliberately NOT in this folder

- Anything Moe should not see (recovery phrase, install token, service-role
  keys, etc.). All of those are on the USB or in the issued bundle.
- A list of "things we don't want him to know" — there isn't one. Radical
  transparency per spec §16-A.

## What's deliberately repetitive between the scripts

The phrase "Disable does NOT delete your client data" appears in:

- The MPA Section 11.2
- The DPA Section 2.1
- The Clickwrap consent
- The pre-install call script (multiple times)
- The shipping email

This is intentional. It's the single most important promise we make to Moe
and the easiest one to be misunderstood. We say it everywhere it could
land.
