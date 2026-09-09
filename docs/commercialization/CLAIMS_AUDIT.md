# COMMERCIAL CLAIMS AUDIT

**What you may truthfully say, and the corrected wording where the shorthand
overstates the build.**

Audit date: 2026-09-07 · Verified against source, live database and authorized
production surfaces.

> Engineering shorthand becomes false marketing when it reaches a sales deck.
> "Attestation", "HMAC", "JWT" and "enforced" have specific meanings, and a buyer's
> security reviewer knows them. **Selling the architecture honestly is more
> credible than overselling the cryptography — and it is the same asset.**

---

| Claim | Evidence | Safe to say? | Corrected language |
|---|---|---|---|
| **Multi-tenant** | 96 of 165 tables carry `org_id`; host/slug/path tenant resolution; per-tenant branding with contrast-checked CSS tokens; custom-domain onboarding with DNS-over-HTTPS verification | ✅ **YES** | "Multi-tenant by architecture — 96 of 165 tables are tenant-scoped, with per-tenant branding and custom domains." |
| **Row-level security** | RLS **enabled on all 165 tables, zero exceptions**; 344 policies | ✅ **YES — one of your strongest true claims** | "Row-level security is enabled on every table in the database, with 344 policies. No table is left open." |
| **Software licensing** | `organization_licenses` with tier, modules, max ventures, validity, revocation; `/api/license/provision` + `/api/license/heartbeat`; issue/kill/burn-USB scripts | ✅ **YES, with care** | "A licence control plane: per-organization licences with module entitlements, one-time install tokens, heartbeat telemetry and remote revocation." |
| **Hardware binding** | `hardware_uuid` stored at provision; heartbeat returns 401 and audits `license.hardware_mismatch` on mismatch | ✅ **YES** | "Each install is bound to a machine identifier; mismatches are rejected and logged." |
| **Secure Enclave** | `enclave_pubkey_pem` is **collected and stored**. **No signature verification exists anywhere in the codebase.** | ⚠️ **PARTLY** | "We collect the machine's enclave public key at install." **Never** "Secure Enclave protected/verified." |
| **Attestation** | Nothing verifies the enclave key or any signature | ❌ **NO** | **Do not use the word.** Collection is not attestation. Say "machine identity is recorded at install." |
| **HMAC** | `hashToken` is **plain unsalted SHA-256**, no key — despite the docstring saying HMAC | ❌ **NO** | "Install tokens are single-use and stored hashed." Do not name the primitive. |
| **JWT / signed licence** | Returns an **opaque SHA-256 digest**. The code's own comment: *"full Ed25519 JWT signing happens once vault is wired"* | ❌ **NO** | "The install handshake returns a session token." **Not** "signed licence" or "JWT". |
| **Kill switch** | Server returns HTTP 410 + `kill_command`. **Enforcement depends entirely on the client honouring it**; a client that ignores it, or stops calling, is unaffected. 24h cache TTL. | ⚠️ **PARTLY** | "Remote revocation: we can mark a licence dead and the client is instructed to stop on its next check-in." **Never** "we can wipe their machine" or "hard kill". |
| **Compliance (credit)** | **All seven legal gates CLOSED** except the permanent CPN prohibition. No attorney-approved CROA suite, no VDACS registration, no surety bond. | ❌ **NO** | "We provide software and education, and refer hands-on credit work to Khan Strategies LLC, an independent company." **Never** "compliant credit repair" or any results claim. |
| **Compliance gates in code** | Config + language detector are real and CI-enforced. **`requireGate()` has zero callers** — no runtime path is gated. | ⚠️ **PARTLY** | "Prohibited-language checks run in our build pipeline." **Not** "every regulated action is gated at runtime." |
| **Owner approval** | Stub with **zero importers**; `requireGate()` zero callers; the enforcement test **passes vacuously**; `GO.command` reports green on **file existence**. ⭐ Mitigator: **no code in the repo moves money** | ❌ **NO** | Say nothing. It is documented, not implemented. *(Immediate exposure: limited — no money-moving path exercises the missing gate. Future exposure: high, the moment commission automation ships.)* |
| **Automated provisioning** | `provision-dealer-instance.mjs` is a **checklist generator**, not an engine — 11 manual steps. `handoffs/` has never been created. The purchase webhook maps a tag to a SKU and **returns a string**; no queue, no worker. | ❌ **NO** | "We stand your instance up for you, following a documented runbook." **Never** "instant" or "automated provisioning." |
| **Self-serve onboarding** | Account creation is **invite-gated**; `signup_invites` has **0 rows, ever**; invites come only from a hand-run script | ❌ **NO** | "We onboard you personally." Manual is fine for a service; it is fatal to a SaaS claim. |
| **Exactly-once execution** | Webhook dispatcher **is** signature-verified, replay-windowed and idempotent — genuinely good. Agent job completion is lease-fenced (`lease_epoch`) per a sibling session's migration. | ✅ **YES, scoped** | "Inbound webhooks are signature-verified and idempotent." Do not generalize to the whole system. |
| **Disaster recovery** | **No verified backup story.** `AIXMOS Flashdrive Backup` last result 1 with no next run; `AIXMOS-VaultCycle` disabled and failing. Three high-value systems are unversioned single-copy. | ❌ **NO** | Say nothing until backups are verified. This is also an internal risk (D-16), not just a claim problem. |
| **Payment readiness** | Code path correct and complete; production config **not inspectable** by this session; GHL products unverified; no organization carries a Stripe subscription | ⚠️ **UNVERIFIED** | Do not promise a customer a self-serve checkout until you have confirmed it in the dashboard yourself. |
| **AI cost control** | Per-org `llm_daily_cap_usd` enforced from the audit log; global kill switch; prepaid token ledger; PII redaction before boundary crossing; banned-phrase regeneration | ✅ **YES** | "Per-tenant AI spend caps enforced against an audit log, with a kill switch and PII redaction." Genuinely differentiated — most products add this after a surprise bill. |
| **SMS compliance** | ✅ Real: opt-out, quiet hours, fail-closed signature verification, CFPB disclaimers. ❌ Not enforced: A2P/CROA vertical gate is **orphaned**; **telephony DNC (`do_not_contact_numbers`) is referenced nowhere in `src`** | ⚠️ **PARTLY** | "Opt-out and quiet hours are enforced." **Never** "fully A2P compliant." **Do not run an outbound campaign until DNC is wired.** |
| **Dispatch as a product** | ~1,482 lines; `incidents` = **0 rows, ever** | ⚠️ **PARTLY** | "We have a dispatch module." **Never** "proven" or "in production". Do not sell it as a paid line yet. |

---

## Two corrections to earlier audit findings

Verified this pass; recorded so they are not repeated.

**1. `PUT /api/cube/application` is NOT an unauthenticated RLS bypass.** A sibling
session flagged it as the worst unguarded path in the codebase. On inspection it
**is** authorized: `authorizeApplicationAccess` does a **timing-safe** comparison of
the deep-link token, or falls back to an authenticated session where staff get any
application and everyone else only an exact email match. Unknown and forbidden both
return 404, so it does not leak existence either.

It does use a service-role client that bypasses RLS — deliberately, because a
token-holder has no session — so the token *is* the credential. Residual risks are
**token distribution and rotation**, and the absence of a CROA `requireGate()` call
(the same finding as "requireGate has zero callers"). **Severity: low-to-medium,
not critical.** No PII was read during verification.

**2. The token-ledger defect is narrower and sharper than reported.** The claim was
"can only grant 500 tokens". In fact `MEMBER_97_MONTHLY_TOKENS` **is
env-configurable** and merely *defaults* to 500. The real defect is different and
worse for the $297 tier: `TOKEN_GRANT_TAGS` contains **only `member-97`**. There is
no grant tag for an operator/$297 tier at all — so raising the env var would hand
2,000 tokens to every $97 member rather than creating a distinct tier.

**Implication for Decision 2:** the $297 seat cannot be delivered *as a separate
tier* without code, whatever the env var says. The smallest honest fix remains
correcting the public claim to what the product delivers — **not** raising the
token cap to make the marketing true.
