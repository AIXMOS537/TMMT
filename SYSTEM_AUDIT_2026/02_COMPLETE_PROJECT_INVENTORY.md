# 02 · COMPLETE PROJECT INVENTORY

## Repository identity
| | |
|---|---|
| Path | `/Users/ceo.moe/projects/TMMT` |
| Remote | `github.com/AIXMOS537/TMMT` (private) |
| Package | `tmmt-app` v0.1.0 |
| Disk | 6.9 GB (843 MB `node_modules`, 498 MB `apps/`, 312 MB `aria/`) |
| Tracked files | 1,451 |

## Tracked files by type
| Ext | Count | Ext | Count |
|---|---:|---|---:|
| `.md` | 373 | `.mjs` | 45 |
| `.ts` | 306 | `.png` | 29 |
| `.tsx` | 222 | `.html` | 26 |
| `.sh` | 153 | `.py` | 22 |
| `.sql` | 48 | `.command` | 19 |
| `.json` | 46 | `.svg` | 17 |

## Tracked files by top-level directory
`src` 461 · `docs` 362 · `scripts` 260 · `supabase` 56 · `AIXMOS` 33 · `apps` 31 · `tools` 26 · `dist` 23 · `public` 22 · `packages` 20 · `config` 16 · `aria` 13 · `shared` 9

**Observation:** 153 shell scripts and 373 markdown files against 528 TypeScript files. Roughly **as much operational scaffolding and prose as application code.** `docs/` alone is 362 files — larger than most teams' entire codebase.

## Application structure
```
src/
  app/          105 page routes · 28 API routes · 15 layouts
  components/   shared UI (DataTable, KanbanBoard, charts, DetailPanel…)
  lib/          23 sub-domains (below)
  middleware.ts 272 lines — auth, tenancy, rate limiting
supabase/
  migrations/   41 files + 3 parked
  functions/    1 edge function (intake)
  schema/       live-ledger TSV + README
```

### `src/lib` sub-domains (23)
`agent` · `agents` · `business-lines` · `clickup` · `client-journey` · `client-rental` · `client-updates` · `command-center-bridge` · `credit-dispute` · `crm-sync` · `forms` · `ghl` · `intake` · `marketing-kpi` · `mission` · `offline` · `operator` · `ops-command` · `people` · `platform` · `routing` · `verticals` · `workflow`

> **Smell:** both `agent/` (29 files) and `agents/` (1 file, `run-on-case.ts`). See `25_DEAD_DUPLICATE_ABANDONED_WORK.md`.

## Secondary trees found on this machine
| Path | Status |
|---|---|
| `~/HAILMARY` | Full sibling tree (`src`, `supabase`, `apps`, `packages`, `e2e`). **Subdirectories are permission-locked (0700) — could not be read.** Classified **UNKNOWN**; requires an owner decision. |
| `~/Documents/_archive/TMMT-1-pre-merge-2026-05-20` | Archived pre-merge repo — corroborates the pre-June history |
| `~/projects/tmmt-credit-app` | Separate Next.js app with its own `supabase-schema.sql` |
| `~/projects/_ARCHIVE-moe-legacy-20260706/*` | 3 archived Moe-lane repos (correctly fenced) |

## Deployment surface (Vercel team `AIXMOS537`)
| Project | Git-linked | Role |
|---|---|---|
| **`tmmt-ops`** | ✅ `AIXMOS537/TMMT` | **Production** |
| `tmmt-command-center` | ❌ | What `.vercel/project.json` wrongly points at |
| `aixmos-landing` | ❌ | Marketing |
| `aixmos-offer` | ❌ | Offer page |
| `tmmt-training-site` | ❌ | Training |
