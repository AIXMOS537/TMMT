# 22 · TESTING AUDIT

## Executed during this audit
```
npx vitest run  →  Test Files 57 passed (57)
                   Tests     472 passed (472)
                   Duration  2.23s
```
**All green.** Plus 6 Playwright E2E specs (`smoke`, `audit`, `dispatch-rls`, `net-only-refactor`) not executed here (they need a live target).

## Coverage by domain
| Domain | Tests | Verdict |
|---|---|---|
| Branding / tenancy | `brand-tokens`, `brand-shell`, `BrandLogo/Name/Provider`, `tenant-map.generated`, `tenant-org`, `tenant-resolve`, `hostname`, `request-org` | 🟢 **strongest area** |
| AI agent compliance | `banned-phrases`, `guard`, `redact-pii`, `twilio-send`, `handoff`, `tenant-overlay`, `ghl-voice-handler`, `sms-gate` | 🟢 excellent |
| GHL | `webhook-auth`, `org-location`, `client-location`, `dealer-provision-queue`, `ghl-links`, `ghl-offers`, `ghl-payment-sync` | 🟢 |
| Money / tokens | `money-meter`, `token-ledger`, `revenue`, `high-ticket`, `kit-checkout` | 🟢 |
| Auth | `auth-roles`, `signup-invite`, `owner-approval-enforcement` | 🟢 |
| Compliance/legal | `compliance`, `copy-compliance`, `banned-phrases` | 🟢 |
| Utility | `utils`, `csv`, `rate-limit`, `internal-links`, `scorecard`, `affiliates`, `referrals` | 🟢 |
| Operators | `academy-modules`, `OnboardClient` | 🟡 |
| **Rental operations** | **none** | 🔴 |
| **Fleet / vehicles** | **none** | 🔴 |
| **Bookings / availability** | **none** | 🔴 |
| **Double-booking** | **none** | 🔴 |
| **Customer payments** | **none** | 🔴 |
| **Owner payouts** | **none** | 🔴 |
| **RLS policies** | 1 E2E (`dispatch-rls`) only | 🟠 |

## The finding
**472 passing tests, and not one of them tests the business the application is named after.**

The test suite mirrors where the engineering effort actually went: branding, tenancy, agents, GHL, tokens. That is an honest signal — **the tests are a truthful map of the real project**, and the real project is a platform, not a rental system.

## High-risk untested workflows
1. **Vehicle availability / double-booking** — no implementation *and* no test.
2. **Payment recording and arrears** — 26 overdue payments, no test.
3. **RLS enforcement** — 168 tables, one E2E spec. `harden_tenant_isolation_phase1` and `fix_org_isolation` are untested at the app layer.
4. **The lead webhook** — the single most business-critical route, no unit test. A test asserting `resolveOrgBySlugPublic("aixmos")` returns a valid org **would have caught P0-1 before deploy.**

## Recommendation
Add exactly one test first: **the lead webhook happy path.** It is the highest-value test in the repo and it is currently absent.
