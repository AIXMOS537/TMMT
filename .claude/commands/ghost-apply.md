Read CLAUDE.md, config/identity.config.json, and specs/*. Update THIS repo to conform 1:1:
1. Replace hardcoded contact (phone/email/address) in customer-facing code/templates/exports with config/identity.config.json → public_contact references.
2. Implement the SMS Compliance Gate (specs/compliance-sms-gate.md) in the gate/middleware layer + tests.
3. Wire feature flags: credit_repair & funding disabled, unlock only owner/umar; sms_marketing_credit_funding hard-locked.
4. Add privacy-invariant CI checks (specs/identity-privacy-invariants.md); source the PII denylist from vault at CI time — never commit PII.
5. Preserve the owner-approval gate everywhere.
HARD RULES: never write the owner's legal name, personal/work cell, personal email, or home address into any file; if found, replace with config/vault refs and list each. Don't enable restricted flags. If a step would violate an invariant/gate, STOP and report.
Output: (a) files changed, (b) every PII occurrence found + remediation, (c) anything not fully wired + why.
