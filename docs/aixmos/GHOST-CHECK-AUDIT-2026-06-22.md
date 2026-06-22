# /ghost-check Audit — 2026-06-22

Read-only exposure audit run when the AIXMOS Ultimatrix overlay was wired in.
**No files were modified by this audit.** PII values are masked below. Remediation
is deferred to a deliberate `/ghost-apply` pass (owner sign-off required) — this
report is the exposure record, not a change.

Scope checked (per `specs/identity-privacy-invariants.md` + `specs/compliance-sms-gate.md`):
1. Hardcoded owner PII (legal name, personal/work cell, personal email, home address)
2. Customer-facing contact as inline literals instead of `config/identity.config.json` refs
3. SMS paths that could send promotional messages on restricted verticals
4. Owner-approval gate bypasses

---

## Finding 1 — Owner legal name is committed (Privacy Invariant #1) — HIGH

The owner's legal name (`M—— T——`) appears **61 times across 43 tracked files**.
Highest-sensitivity occurrences are **customer-facing**:

- `AIXMOS/public/index.html`, `AIXMOS/portal/index.html` — public site surfaces
- `src/lib/referrals.ts`, `src/lib/platform/brand-shell.ts` — shipped app code
- `CLAUDE.md:275` (`docs/ACCESS-GOVERNANCE.md` defines `X = <legal name>`)
- plus ~38 docs/scripts/migrations (lower exposure, still committed)

Invariant #1 says the ghost (legal identity) must never appear in a customer-facing
surface or committed file. The public `AIXMOS/` HTML is the urgent one.

**Suggested fix (deferred):** replace customer-facing occurrences with the operator
persona / entity name from `config/identity.config.json`; keep the legal name only
where law requires a real signature (none of these files qualify).

## Finding 2 — Inline contact literals in customer-facing code (Privacy Invariant #2) — MED

| File:line | Literal (masked) | Notes |
|---|---|---|
| `public/explainer.html:591` | `management@tmmt——.com · 571-———-————` | email **and** phone inline; confirm the number is the public GHL forward line, not a cell |
| `src/app/legal/credit/page.tsx:47,57` | `hello@tmmt——.com` | ×2 |
| `src/app/legal/funding/page.tsx:42` | `hello@tmmt——.com` | revoke-consent contact |
| `src/app/legal/privacy/page.tsx:38` | `hello@tmmt——.com` | data-request contact |
| `src/lib/ops-command/stage-rules.ts:24` | `management@tmmt——.net` | routing target |
| `src/lib/osm-geocode.ts:6` | `operations@tmmt——.com` | OSM User-Agent — operational, low risk |
| `src/lib/verticals/registry.ts:93` | `umar4————@yahoo.com` | partner's **personal** address as `foundingAdminEmails` — move to alias |

Invariant #2 wants these sourced from `config/identity.config.json → public_contact`.
The phone in `explainer.html` should be verified as the GHL public number.

## Finding 3 — SMS send path has no vertical/marketing gate (Compliance Gate #1) — HIGH

`src/lib/agent/twilio-send.ts` (`sendSms`) enforces a per-tenant **rate limit only**.
There is **no gate on vertical or message type** before `client.messages.create(...)`.
Nothing structurally prevents a promotional SMS on `credit_repair` / `funding` /
`debt_relief` / `lending`, which A2P 10DLC + CROA prohibit.

Good foundation already present: `config/credit-compliance.json` (content guardrails)
and `src/lib/verticals/registry.ts` (credit/funding marked). What's missing is the
**send-time block** described in `specs/compliance-sms-gate.md`.

**Suggested fix (deferred):** add the gate in the SMS send/campaign-config layer —
`if vertical ∈ restricted && type == marketing → BLOCK` — plus the listed tests.

## Finding 4 — Owner-approval gate — REVIEW

No bypass found in the SMS path. The approval gate is referenced in config but its
enforcement across all customer-facing/financial actions was not exhaustively traced
in this read-only pass. Recommend a focused trace before `/ghost-apply`.

---

## Next steps (owner-driven)
1. Fill real values into `config/identity.config.json` (GHL number, alias email, virtual address).
2. Fill `.aixmos/pii_denylist.local` (gitignored) and set the `PII_DENYLIST` repo secret so CI guards future pushes.
3. When ready, run `/ghost-apply` deliberately to remediate Findings 1–3 (rewrites code — review the diff).
