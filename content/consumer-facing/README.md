# Consumer-facing copy (compliance-gated)

Put any text shown/sent to consumers for the credit-repair / funding product here
(.md / .txt / .html). The fact-check gate runs `compliance-check.mjs` over this
folder, so prohibited claims **block the build** and missing disclosures are warned.

- Prohibited claims → `verify.checks` fails (red). Fix before shipping.
- Keep the required disclosures present (see `disclaimer.md`).
- This does NOT replace counsel review (`docs/CREDIT-FUNDING-COMPLIANCE.md`).
