# HEALTH.md — baseline check results

> Catch-up deliverable · STEP 2 · run 2026-06-28 · branch `claude/catchup-aixmos-tmmt-5wv942`
> These are the **existing** checks, run as-is on a fresh clone. This is the line
> that "green stays green" refers to: after any change, these must not get worse.
> Toolchain: node v22.22.2 · npm 10.9.7 · python 3.11.15. `npm ci` succeeded clean.

---

## Baseline scoreboard

| # | Check | Command | Result | Exit |
|---|-------|---------|--------|------|
| 1 | TypeScript (strict) | `npx tsc --noEmit` | ✅ PASS | 0 |
| 2 | ESLint | `npm run lint` | ❌ **FAIL** — 1 error, 48 warnings | 1 |
| 3 | Unit/DOM tests | `npm run test` (vitest) | ✅ PASS — 190/190 (26 files) | 0 |
| 4 | Production build | `npm run build` (next build) | ✅ PASS | 0 |
| 5 | Compliance gate posture | `python3 shared/compliance-gates/check.py` | ✅ PASS | 0 |
| 6 | Content/claims compliance | `node scripts/compliance-check.mjs content/consumer-facing` | ✅ PASS (13 disclosure warnings, non-fatal) | 0 |
| 7 | Secret scan | `bash scripts/secret-scan.sh` | ❌ **FAIL** — 1 finding (env-reference false positive) | 1 |
| 8 | Readiness/security audit | `bash scripts/doctor.sh --quick` | ✅ PASS — 13 pass / 4 warn / 0 fail | 0 |
| 9 | PII guard (CI: pii-guard.yml) | `bash ultimatrix.sh scan` | ✅ PASS — warnings only, 0 denylist matches | 0 |

**Green to protect (must stay 0-exit):** #1 tsc, #3 tests, #4 build, #5 gate posture,
#6 content compliance, #8 doctor, #9 PII.
**Already red at baseline (pre-existing — not caused by this catch-up):** #2 lint, #7 secret-scan.

---

## Detail on the two reds

### #2 ESLint — 1 error + 48 warnings (pre-existing)
- **The 1 hard error:** `web/build-page/catalog.buildpage.ts:39:73` —
  `Unexpected any. Specify a different type (@typescript-eslint/no-explicit-any)`.
- **The 48 warnings:** mostly `react-hooks/set-state-in-effect` (e.g.
  `src/components/VoiceCapture.tsx:39`, theme toggler) and similar effect/any warnings.
- **Verdict:** the single **error** is a clean, no-judgment safe-fix candidate (Step 4).
  The warnings are advisory and don't fail the check by themselves; leaving them is fine.
- Note: `web/build-page/` is a standalone deliverable (`tools/`-style), not part of the
  Next.js app build (#4 passed), which is why lint can be red while build is green.

### #7 secret-scan — 1 finding (pre-existing false positive)
- The scanner's own report flags the match as **"an env reference, not a literal"**:
  the hit is `const API_TOKEN = process.env...` in a docs/security example and a script.
- **This is a false positive on the generic-secret regex, not a leaked secret.** No real
  credential is exposed (gitleaks + PII guard + doctor secret-hygiene all pass clean).
- **Verdict:** do NOT auto-"fix" by editing scanner logic or the example files —
  that's judgment work. Flagged for owner in STATUS.md as a low-priority allowlist tweak.

---

## Doctor warnings (all expected on a fresh cloud container — informational)
- `gitleaks not installed` — falls back to built-in pattern guard (fine here).
- `machine name not set` / `git hooks not installed` — set by `scripts/swarm-join.sh`
  on a real operator machine; not applicable in this ephemeral env.
- `.env missing` — expected; no secrets in the container. App **built anyway** (#4).

## Content-compliance warnings (informational, non-fatal)
13 "missing required disclosure" warnings across `content/consumer-facing/README.md`,
`disclaimer.md`, `redhood-ad-templates.md`. These are **credit/funding (CROA) copy** —
REPORT-ONLY per the ground rules; left for owner + Umar, not auto-edited.

---

*This is the baseline. Every change in Step 4 was followed by a re-run of the relevant
checks; any change that turned a ✅ into ❌ was reverted. See STATUS.md / PLAN.md.*
