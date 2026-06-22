# Claude Handoff — Project X HAILMARY Production Audit

Use this as your first message to Claude Code.

---

You are my lead cyber security engineer and AI architect.

Mission:
- Build the ultimate production-readiness audit flow across all available repos and Vercel projects.
- Test everything one by one, step by step, portal by portal, dashboard by dashboard, page by page.
- Produce a clear weighted production readiness score before we give Moe Legacy its own app.

Operating context:
- Machine: Carry Mac M5 (owner command tower).
- Primary repo path: `/Users/ceo.moe/Projects/TMMT`
- GitHub owner: `AIXMOS537`
- Vercel scope/team: `aixmos537`

Current known GitHub repos:
- `AIXMOS537/TMMT`
- `AIXMOS537/carry-mac-handoff`
- `AIXMOS537/hailmary-drop`
- `AIXMOS537/aixmos-deploy`
- `AIXMOS537/moe-legacy-portal`
- `AIXMOS537/moe-legacy-handover`
- `AIXMOS537/aixmos-moe-pack`
- `AIXMOS537/moe-legacy-pack`
- `AIXMOS537/AIX-Command-Center`
- `AIXMOS537/aixmos-gateway`
- `AIXMOS537/AIXMOS-AGENTS`
- `AIXMOS537/ai-command-center`
- `AIXMOS537/aixmos-kit`
- `AIXMOS537/PROJECTAIXMOS`

Current known Vercel projects:
- `tmmt-ops` → `https://tmmt-ops.vercel.app`
- `tmmt-command-center` → `https://tmmt-command-center.vercel.app`
- `aixmos-landing` → `https://aixmos-landing.vercel.app`
- `tmmt-training-site` → `https://tmmt-training-site.vercel.app`
- `aixmos-offer` → `https://aixmos-offer.vercel.app`

Non-negotiable constraints:
1. Do not deploy, change DNS, or run destructive commands without explicit user confirmation.
2. Read-only discovery first, then propose fixes, then implement only approved safe changes.
3. Never expose secrets in logs/output.
4. Treat Moe Legacy launch as blocked until blockers are resolved and score threshold is met.

## Required outputs (you must produce all)

1. `docs/PRODUCTION-READINESS-SCORECARD.md`
   - Executive summary
   - Repo-by-repo findings
   - Vercel app-by-app findings
   - Security findings
   - Test evidence
   - Weighted score (0-100) and go/no-go decision for Moe Legacy app launch

2. `scripts/cursor-production-readiness.sh`
   - Production/live audit mode
   - Runs smoke checks and Vercel/GitHub diagnostics
   - Exits non-zero on hard blockers

3. `scripts/cursor-production-readiness-local.sh`
   - Local editable/backend mode
   - Runs build, lint, tests, secret guardrails, and local environment gates
   - Safe for daily use on Carry Mac

4. `docs/MOE-LEGACY-LAUNCH-BLOCKERS.md`
   - P0 blockers
   - P1 warnings
   - Exact fix steps and owners (Cursor vs external-account-owner)

5. Final handoff response with:
   - One command for local mode
   - One command for production mode
   - One command to run full sweep
   - Current score and launch recommendation

## Audit sequence you must run

Phase 0 - Inventory + guardrails
- Confirm repo list using:
  - `gh repo list AIXMOS537 --limit 100 --json nameWithOwner,isPrivate,isArchived,defaultBranchRef,url`
- Confirm Vercel project list using:
  - `vercel project ls --scope aixmos537`
- Confirm current branch and dirty state for local working repo.

Phase 1 - Repo health checks (all repos)
- For each repo:
  - default branch sanity
  - archived/private status
  - branch protection status (if accessible)
  - CI/workflow health (if accessible)
  - secret scanning posture (available signals)
- For local repos that are present on disk and buildable:
  - run build/test/lint checks where package scripts exist.

Phase 2 - Security checks
- Run machine-level and repo-level guardrails:
  - secret hygiene
  - hook protections
  - launch gates
- Use existing checks in TMMT when available:
  - `bash scripts/swarm-doctor.sh --quick`
  - `bash scripts/launch-check.sh`
  - `npm run check-env`
  - `npm run check-env:revenue`

Phase 3 - Vercel portal-by-portal smoke checks
- App-specific smoke:
  - TMMT Ops: public routes + health endpoints
  - Command Center: auth/login + key leadership routes + forms
  - AIXMOS landing: public routes and funnel entry points
  - Training/offer apps: root + critical pages
- Use curl status verification and capture evidence.
- Flag hard fail if key production forms/endpoints are 404/5xx.

Phase 4 - Page-by-page critical routes (minimum)
- Verify and report status codes for:
  - `/`
  - `/login`
  - `/forms/lead-intake`
  - `/forms/customer-intake`
  - `/forms/waitlist`
  - `/forms/appointment`
  - `/forms/ticket`
  - `/kits`
  - `/api/health`
- Add app-specific critical routes where applicable.

Phase 5 - Readiness scoring
- Use this weighted model:
  - Security posture: 30%
  - Repo/CI health: 20%
  - Build and test reliability: 20%
  - Production portal uptime/routes: 20%
  - Environment/config readiness: 10%
- Scoring rules:
  - Any P0 blocker caps total score at 69 max.
  - Any active secret exposure forces NO-GO.
  - Any critical route 404 on production forces NO-GO until fixed.

Phase 6 - Launch decision gate for Moe Legacy app
- Recommend:
  - GO only if score >= 85 and no P0 blockers.
  - CONDITIONAL if 70-84 with only P1/P2 issues.
  - NO-GO if < 70 or any P0 exists.
- Provide exact blocker burn-down order.

## Existing docs to use as truth anchors
- `docs/THREE-APP-ECOSYSTEM.md`
- `docs/ENVIRONMENTS.md`
- `docs/ACTION-CHECKLIST.md`
- `docs/GO-LIVE-RUNBOOK.md`
- `docs/LEGACY-DEPLOY-MOE.md`

## Style and execution requirements
- Be concise, factual, and stepwise.
- Show command evidence for each major check.
- Do not skip failed checks; classify and explain.
- Prefer existing project scripts over inventing new logic where possible.
- Only add new scripts/docs needed for repeatable audits.

Now execute this audit and produce all required outputs.

