# Command Center carry-over audit

Answers one question: **if `tmmt-command-center` is paused, is anything lost?**

**Short answer: no.** Its entire tree is preserved at tag
`archive/command-center-2026-05-18` (`0cfcadd`). Pausing stops a deployment; it
deletes no code. But "everything is already in master" would be false, so this is
the honest inventory.

## Method

The two histories are **disjoint** — `0cfcadd` has no common ancestor with
`master`, so commits cannot be diffed. Compared file trees instead.

| | files |
|---|---|
| command-center tree | 417 |
| master tree | 1,338 |
| in both | 93 |
| **only in command-center** | **324** |

## Triage of the 324

| bucket | files | verdict |
|---|---|---|
| `src/app/v/[venture]/**` | 25 | **Superseded** — do not port |
| `tmmt-os/**` | 201 | Separate app; 88 also live in `AIXMOS537/AIX-Command-Center` |
| Ops/docs dirs (`AUTOMATIONS`, `EXECUTION`, `AI_BRAIN`, `SOPS`, `FLEET`, `CUSTOMERS`, `OPERATIONS`, `INTEGRATIONS`, `DATA`) | 60 | Owner call — business docs, not app code |
| `supabase/migrations/20260517120000_command_center_ventures.sql` | 1 | Superseded by live schema |
| Machine-sync scripts, shell components, misc docs | 34 | Mostly obsolete — see below |
| `tmmt-os.zip`, `ziKcON7Q`, an `.xlsx` | 3 | Junk |

### Why the venture routes are superseded, not missing

Command-center (May 2026) scoped tenants **by URL**: `/v/[venture]/fleet`,
`/v/[venture]/leads`, and ~23 more.

Master (Aug 2026) scopes them **by tenant-map + row-level security**:

- `src/lib/platform/tenant-resolve.ts` and `tenant-map.generated.ts` (both tested)
- `src/lib/agent/tenant.ts`, `src/lib/agent/persona/tenant-overlay.ts`
- `src/app/lp/[org]/[sku]/` — org-scoped landing pages
- live Supabase RLS: `is_org_member(org_id)` on fleet, leads, contracts, customers,
  insurance and more

Same capability, newer implementation, and unlike the May version it is wired to
the production database. Porting `/v/[venture]/**` forward would re-introduce a
second, weaker tenancy model beside the real one.

### ⛔ Never run the tmmt-os migrations against production

`tmmt-os/supabase/migrations/0001_init.sql` through `0009_ops_command.sql` are a
**greenfield schema for a different app**. The live project (`uapxakmlwnpfsftfeezx`)
has 152 tables, hardened RLS, and its own migration history. Applying these would
be destructive. They are archived history only.

### The 34 "misc" files

Largely superseded infrastructure: `scripts/office-*`, `scripts/install-office-*`
and `scripts/windows/sync-machine.ps1` automate a two-machine dev-sync workflow
replaced by the work-baton system. `CommandCenterShell.tsx` and
`use-venture-slug.ts` belong to the superseded venture routing. Worth a look
before discarding: `FINANCE/FINANCE_TRACKER.md`, `LEGAL/LEGAL_INDEX.md`,
`REPORTS/WEEKLY_OPERATIONS_REPORT.md`, and the two 2026-05-17 command-center
architecture documents under `docs/superpowers/`.

## Recommendation

1. **Pause is safe now.** Nothing is lost; the tag holds the full tree.
2. **Port nothing automatically.** Bulk-merging 324 files from a disjoint history
   into canon is the same mistake as PR #5.
3. If the 60 ops/docs files matter as business records, lift those specific files
   out of the tag — they are documents, not code, and carry no merge risk.
4. Decide `tmmt-os` separately: it is a whole app, partly mirrored in
   `AIX-Command-Center`, and does not belong inside `tmmt-app`.

Recover anything with:

    git show archive/command-center-2026-05-18:<path>
    git log archive/command-center-2026-05-18
