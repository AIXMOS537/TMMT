# One project: folding TMMT OS into tmmt-ops

**Owner decision, 2026-09-09:** "tmmt os and tmmt ops and tmmt command center
ARE ALL MEANT TO BE ONE UNIFIED CLEAN PROJECT."

This supersedes the "Do not unify Vercel" line carried in the work baton, which
was about not merging Vercel *projects* on a whim. It does not lift the standing
gates: prod deploy, money, send and sign stay owner-gated.

## What the three names actually are

| Name | What it is | State |
|---|---|---|
| **tmmt-ops** | Vercel project, git-linked to `AIXMOS537/TMMT`, auto-deploys `master`. This repo. | **Live.** `tmmt-ops.vercel.app` |
| **TMMT OS** | A *separate* Next app — and **three divergent working copies of it**, none a superset of the others. All three are preserved as branches of `AIXMOS537/TMMT-OS-ARCHIVE` (`master`, `dev-copy-cdev`, `cyborg-kit`); read its `README-ARCHIVE.md` before porting anything. | Not deployed anywhere |
| **tmmt-command-center** | A Vercel project, not a codebase. Deployed from a stale branch of *this same repo* (`cursor/tmmt-management-initial-setup`, 2026-07-18). | Paused, 503. Already declared retired in `src/lib/site-domains.ts` |

So it is **two codebases and one dead Vercel project**, not three projects.
Nothing needs to be merged out of tmmt-command-center — it is this repo at an old
commit. Leave it paused; deleting it frees a name and nothing else, and a
delete of an unlinked Vercel project is irreversible.

## Base: this repo

tmmt-ops is the base and TMMT OS folds into it. It is the deployed one, it is
git-linked and auto-deploying, it carries the security work (PRs #190-#223), and
it holds 459 files TMMT OS does not — dispatch, credit-dispute command, pocket,
operator, learn, legal, credit-funding, lp. TMMT OS holds 298 this repo does not,
almost all of it front door and portals.

## What makes this a port, not a copy

Measured 2026-09-09.

**The two trees have forked.** 64 file paths exist in both. **23 are identical;
41 have diverged.** The diverged set is not cosmetic — it is the integration
layer both apps run against the *same live Supabase project*
(`uapxakmlwnpfsftfeezx`) and the *same GHL account*:

```
src/lib/ghl/webhook-auth.ts        src/lib/crm-sync/airtable.ts
src/lib/ghl/http.ts                src/lib/crm-sync/apply-verified.ts
src/lib/ghl/client.ts              src/lib/crm-sync/labels.ts
src/lib/ghl/resolve-contact.ts     src/lib/client-journey/{queries,recompute,types}.ts
src/lib/ghl/sync-outbound.ts       src/lib/intake/unified.ts
src/lib/ghl/handlers/*.ts (4)      src/lib/ops-command/{execute,parse-message}.ts
src/app/api/webhooks/ghl/route.ts  src/app/api/webhooks/airtable/route.ts
```

Both apps carry a full `/api/webhooks/ghl/*` surface. Only this one is deployed,
so TMMT OS's copies are dead code that reads as live. **Deploying TMMT OS as-is
would put a second, older webhook receiver on the internet against the same GHL
location.** That is the single biggest hazard here, and it is why the answer is
one project rather than two that link to each other.

**Three major-version gaps.** Nothing ports by copy-paste:

| | tmmt-ops | TMMT OS |
|---|---|---|
| Next | 16.2.11 | 14.2.15 |
| React | 19.2.4 | 18.3.1 |
| Tailwind | 4 (config-in-CSS) | 3 (`tailwind.config.ts`) |

Every ported page needs the Next 16 / React 19 pass — `params` and
`searchParams` are promises, `cookies()` is awaited — and every ported style
needs the Tailwind 3 → 4 pass.

**No shared UI kit.** This repo has no `src/components/ui/` at all. TMMT OS's
front door is built on shadcn (`button`, `card`, `input`, `label`, `select`,
`textarea`) over a full token set. `globals.css` here defines three of those
tokens (`--border`, `--muted`, `--muted-foreground`); TMMT OS defines twelve.
Phase 1 has to bring the tokens in without restyling pages already live.

## Port from the archive, not from one folder

This plan was first written against `C:\dev\tmmt-os` alone — the 449-file copy.
That was wrong: there are three copies and each holds work the others do not.
`dev-copy-cdev` has fast-track and the tailoring layer; `master` has the GHL
dispatch system, the local-brain integration and eight screens the others lack;
`cyborg-kit` has the operator agent tooling and the team-onboarding set. **Check
all three branches before porting any subsystem**, or the port silently drops
whichever half lives elsewhere.

## Phases

Each phase is one PR, green before the next starts.

**Phase 1 — the front door. DONE, this PR.** Source: `dev-copy-cdev`, the only branch carrying `src/lib/tailor/*`. This repo has no `src/app/page.tsx`; `/` redirects
signed-out visitors to `/login` (PR #223). Bring in the TMMT OS home page, the
tailoring layer (`src/lib/tailor/*` + `config/tailor.json` — note
`config-from-lexar/tailor.json` is already parked in this repo, unwired), make
`src/lib/business-lines/registry.ts` tailor-aware, and add the six `ui/`
primitives with their tokens. ~20 files. Middleware gains `/` and `/intake` as
public paths. **This reverses PR #223's `/` behaviour on purpose** — that PR made
`/` bounce to `/login` precisely because the app had no front door. Now it has one.

**Phase 2 — intake.** This repo intakes through `/forms/[slug]` (17 slugs);
TMMT OS intakes through `/intake/[business]` (10 lines) on a shared
`src/lib/intake/unified.ts` that has *diverged between them*. Reconcile
`unified.ts` first, then decide which URL shape survives and redirect the other.
Do not run both.

**Phase 3 — the integration layer.** Reconcile the 41 diverged files, this
repo's version winning by default (it is the one in production and the one the
T-02c replay guards and F-18 degraded-mode work landed in). Delete TMMT OS's
webhook routes rather than merge them.

**Phase 4 — portals.** `/client/*`, `/team/*`, `/vendor/*`, `/investor/*`,
`/portals`, and the `/v/[venture]/*` rentals admin. Largest phase; overlaps this
repo's `(admin)` routes (`leads`, `customers`, `payments`, `vendors`, `waitlist`,
`do-not-rent`, `inspections`, `insurance`, `maintenance`, `tickets`, `expenses`,
`operation-costs`, `interfaces/*`) which are the same screens at different URLs.
Pick one URL shape before porting, not after.

**Phase 5 — retire.** Archive `C:\dev\tmmt-os` read-only. Leave the
tmmt-command-center Vercel project paused. One repo, one Vercel project.

## Rules while this is in flight

- `C:\dev\tmmt-os` is the working copy of TMMT OS. Never the OneDrive path —
  OneDrive dehydrated its `node_modules` and nothing there can build.
- Do not give TMMT OS a Vercel project. A second live webhook receiver against
  the same GHL location is the failure this plan exists to avoid.
- Do not apply `vercel.portal-rewrites.json` in TMMT OS. It forwards
  `/internal/*`, `/api/webhooks/*` and `/api/status` to tmmt-ops and would
  shadow routes TMMT OS serves itself. Its target host is dead anyway.
- `tmmt-c919-two.vercel.app` is gone (404). It is not a fallback.
