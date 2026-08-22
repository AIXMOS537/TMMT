# Circular dependency baseline — 2026-08-22

**Repo:** TMMT `src/`  
**Method:** local TypeScript AST walker (`scripts/circular-deps.mjs`) using `typescript` already in `node_modules`. No new packages. Not wired into CI.  
**Cross-check:** `npx madge --circular --extensions ts,tsx src` → **No circular dependency found** (410 files, 146 unresolved-module warnings).

Webhook and payment files were not modified. `.github/workflows` was not touched.

---

## Result

| Metric | Value |
|--------|-------|
| Files scanned (`src/**/*.ts`, `src/**/*.tsx`, skip `.d.ts`) | **407** |
| Resolved local/alias import edges | 788 |
| Type-only edges (included in the graph) | 65 |
| Unresolved local/alias imports | 3 (see below) |
| Cyclic SCCs | **0** |
| Simple cycles | **0** |

**Top 15 cycles:** none. The `src/` import graph is a DAG.

### Unresolved local/alias imports (not cycles)

| File | Specifier | Why skipped |
|------|-----------|-------------|
| `src/app/layout.tsx` | `./globals.css` | CSS, not a TS module |
| `src/lib/agent/twilio-send.ts` | `../../../shared/compliance-gates/sms-gate` | Outside `src/` (no back-edge into `src/`) |
| `src/lib/agent/twilio-send.test.ts` | same | same |

`shared/compliance-gates/sms-gate.ts` imports `config/identity.config.json` only. It does not import back into `src/`, so it cannot close a cycle.

### Wider trees (not the baseline, checked so “55” could not hide elsewhere)

| Tree | Madge files | Cycles |
|------|-------------|--------|
| `packages/aixmos-core/src` | 17 | 0 |
| `apps/engine` | 25 | 0 |
| `aria` | 8 | 0 |

---

## Was the PRD “55 cycles” real?

**High / not real for this repo’s TypeScript import graph.**

Two independent walkers (this script + madge) found **zero** file-level import cycles in `src/`. Adjacent TS trees also have zero. 55 is not a measured baseline here.

Likely sources of the 55 number (unverified, do not treat as fact):

- A different repo snapshot or a scan that counted something other than import cycles (folder coupling, ESLint import noise, type-check error count).
- A tool run without path-alias resolution that invented false edges — our walker resolves `@/*` via `tsconfig` paths; madge still reported 0 cycles even with 146 “can’t resolve” warnings.
- An estimate that was never re-run.

File-count delta vs madge (407 vs 410) is 3 files and does not change the cycle count.

---

## Coupling hubs (not cycles — do not cut yet)

Highest fan-in inside `src/` — these are one-way hubs, not circular:

| Fan-in | File |
|-------:|------|
| 76 | `src/components/ui.tsx` |
| 45 | `src/lib/utils.ts` |
| 39 | `src/lib/queries.ts` |
| 31 | `src/lib/supabase-server.ts` |
| 28 | `src/lib/supabase-service.ts` |
| 23 | `src/app/(admin)/admin-actions.ts` |
| 19 | `src/lib/auth-roles.ts` |
| 13 | `src/app/forms/actions.ts` |
| 13 | `src/lib/agent/supabase-server.ts` |
| 12 | `src/components/brand/BrandName.tsx` |

---

## Recommended next cut

**Do not start a cycle-breaking refactor.** There is nothing to split for circular imports.

If later work is about *coupling* (the PRD smell, not cycles):

1. Keep this script as a regression check before large moves. Re-run after any new `index.ts` barrel under `src/lib/`.
2. First real cut candidate, if a human later wants smaller modules: split `src/lib/queries.ts` (39 importers) into domain query files. That is fan-in, not a cycle.
3. Second: split `src/components/ui.tsx` only if it is slowing compiles or pulling unused UI into server files. Cosmetic until proven.
4. Leave webhook/payment modules alone. Leave CI alone.

---

## How to re-run (offline)

```bash
cd /Users/projectaixmos01/projects/TMMT
node scripts/circular-deps.mjs
node scripts/circular-deps.mjs --json
node scripts/circular-deps.mjs --limit 15
```

Uses `node_modules/typescript` only. No `npm install`. No CI hook.

Optional one-shot cross-check (downloads madge via npx; not a repo dependency):

```bash
npx --yes madge --circular --extensions ts,tsx src
```
