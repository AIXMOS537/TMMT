# Portfolio Command Center — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend TMMT Rentals into a portfolio command center — multi-venture shell, team workspaces, scripts library, and NAS backup pipeline — without breaking daily rental ops or the partner portal.

**Architecture:** Phased, additive rollout. Phase 0 moves existing `(admin)/` routes under `/v/[venture]/*`, adds portfolio home at `/`, and seeds `ventures`. Phases 1–4 add teams, scripts index, venture onboarding runbook, and backup scripts. `tmmt-os/` (internal/vendor/investor portal) stays a **separate app** in v1; do not merge it into this plan unless explicitly scoped later.

**Tech stack:** Next.js 16 App Router (`TMMT MANAGEMENT/`), TypeScript, Tailwind CSS 4, Supabase (existing project), Playwright E2E

**Spec:** `docs/superpowers/specs/2026-05-17-command-center-architecture-design.md`

**App root:** `TMMT MANAGEMENT/` (not `tmmt-os/`)

---

## Owner decisions (resolve before Phase 0)

| # | Question | Recommendation | Your call |
|---|----------|----------------|-----------|
| 1 | One Supabase project for all ventures? | Yes for v1 | ☐ |
| 2 | Solo-venture users: auto-redirect `/` → `/v/tmmt-rentals`? | Yes (spec default) | ☐ |
| 3 | Portfolio dashboard visible when only one venture? | Yes, with optional redirect after login | ☐ |
| 4 | `tmmt-os` in backup manifest? | Yes, as separate path entry | ☐ |
| 5 | Flash bundle: plain folder on staging, optional `.tar.gz` on copy | Per spec | ☐ |

---

## Current inventory (baseline)

| Area | Count / path |
|------|----------------|
| Admin pages | 22 under `src/app/(admin)/` (dashboard + 17 data pages + 4 interfaces) |
| Public forms | 9 under `src/app/forms/` (incl. license-upload) |
| Partner portal | `src/app/(partner)/partner/` |
| Auth | `src/app/(auth)/login/` |
| Middleware | `middleware.ts` — staff vs `partner` tier |
| Sidebar links | 21 hrefs, all root-relative (`/fleet`, etc.) |
| Seed scripts (Phase 2) | `AUTOMATIONS/SCRIPTS/` (5 files), `AI_BRAIN/PROMPTS/` (2 files) |
| Sibling app | `tmmt-os/` — own Next.js app, out of Phase 0 route move |

---

## Target route map (end state)

```
/                              Portfolio dashboard (staff)
/v/[venture]/                  Venture home (today's admin dashboard)
/v/[venture]/fleet             … all former (admin) pages
/v/[venture]/interfaces/…
/teams                         Team index
/teams/[slug]                  Team workspace (4 tabs)
/scripts                       Scripts library
/settings                      Ventures / teams / integrations (stub OK in v1)
/partner                       Unchanged
/forms/*                       Unchanged
/login                         Unchanged
```

**308 redirects (Phase 0):** every old staff path → `/v/tmmt-rentals<same-path>` (see redirect table in Task 0.6).

---

## File structure (summary)

### Phase 0 — new / moved

```
src/app/
  page.tsx                              # Portfolio dashboard (replaces redirect-only root)
  v/[venture]/
    layout.tsx                          # Venture layout + Sidebar
    page.tsx                            # Moved from (admin)/page.tsx
    fleet/page.tsx                      # Moved from (admin)/fleet/page.tsx
    … (all other admin pages)
  (admin)/                              # DELETE after move (empty)
src/lib/
  ventures.ts                           # getVentures(), getVentureBySlug(), assertVenture()
  venture-context.tsx                   # Optional client context for slug
src/components/
  Sidebar.tsx                           # Venture-prefixed hrefs + portfolio nav
  PortfolioShell.tsx                    # Optional top bar: venture switcher
middleware.ts                           # Venture slug guard, solo-redirect
next.config.ts                          # permanent redirects for legacy paths
supabase/migrations/
  20260517120000_command_center_ventures.sql
e2e/
  venture-routes.spec.ts                # Redirect + smoke on new paths
```

### Phase 1 — teams

```
src/app/teams/page.tsx
src/app/teams/[slug]/page.tsx
src/app/teams/[slug]/team-actions.ts
src/lib/queries/teams.ts
supabase/migrations/20260518120000_command_center_teams.sql
```

### Phase 2 — scripts

```
AIX_Command_Center/scripts-library/     # At monorepo root (sibling to TMMT MANAGEMENT)
scripts/sync-scripts-library.mjs
src/app/scripts/page.tsx
src/app/scripts/[id]/page.tsx
src/lib/scripts-library.ts
supabase/migrations/20260519120000_script_library_items.sql
```

### Phase 4 — backup

```
scripts/prepare-nas-bundle.mjs
scripts/backup-to-nas.sh
backup.manifest.json
docs/BACKUP-WORKFLOW.md                  # Operator runbook (only if owner wants a doc file)
```

---

# Phase 0 — Foundation restructure

**Estimate:** 1–2 days  
**Risk:** High (touches every admin URL + Sidebar + middleware)  
**Ship gate:** `npm run build` + Playwright redirect sweep + manual smoke on fleet + one form

---

## Task 0.1: Ventures migration + seed

**Files:**
- Create: `supabase/migrations/20260517120000_command_center_ventures.sql`
- Create: `src/lib/ventures.ts`

- [ ] **Step 1: Add migration**

```sql
-- ventures + RLS (staff read/write; partners no access)
create table public.ventures (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  color text,
  logo_url text,
  status text not null default 'active'
    check (status in ('active','paused','archived')),
  pinned_widgets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.ventures (slug, name, description, color, status)
values (
  'tmmt-rentals',
  'TMMT Rentals',
  'Vehicle rental operations (fleet, leads, customers, tickets)',
  '#2563eb',
  'active'
);

alter table public.ventures enable row level security;

create policy "staff_all_ventures" on public.ventures
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());
```

> Uses existing `is_staff()` from partner-portal migration. If missing in a fresh DB, apply `20260503120000_partner_portal_rls.sql` first.

- [ ] **Step 2: Add `src/lib/ventures.ts`**

```ts
import { createSSRClient } from "@/lib/supabase-server";

export type Venture = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  logo_url: string | null;
  status: "active" | "paused" | "archived";
  pinned_widgets: unknown;
};

export async function getActiveVentures(): Promise<Venture[]> {
  const supabase = await createSSRClient();
  const { data, error } = await supabase
    .from("ventures")
    .select("*")
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getVentureBySlug(slug: string): Promise<Venture | null> {
  const supabase = await createSSRClient();
  const { data, error } = await supabase
    .from("ventures")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 3: Apply migration** (Supabase dashboard or CLI)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260517120000_command_center_ventures.sql src/lib/ventures.ts
git commit -m "feat(command-center): add ventures table and query helpers"
```

---

## Task 0.2: Move admin routes under `/v/[venture]`

**Files:**
- Move: entire `src/app/(admin)/*` → `src/app/v/[venture]/*`
- Create: `src/app/v/[venture]/layout.tsx` (from `(admin)/layout.tsx`)
- Delete: `src/app/(admin)/` (after move)

- [ ] **Step 1: Create venture layout**

Copy `(admin)/layout.tsx` to `src/app/v/[venture]/layout.tsx`. Add server-side venture validation:

```tsx
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getVentureBySlug } from "@/lib/ventures";

export default async function VentureLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ venture: string }>;
}) {
  const { venture: slug } = await params;
  const venture = await getVentureBySlug(slug);
  if (!venture || venture.status !== "active") notFound();

  return (
    <>
      <Sidebar ventureSlug={slug} ventureName={venture.name} ventureColor={venture.color} />
      <main className="lg:pl-64 min-h-screen">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Move pages**

Move each directory/file from `(admin)/` to `v/[venture]/` preserving relative paths:

| From | To |
|------|-----|
| `(admin)/page.tsx` | `v/[venture]/page.tsx` |
| `(admin)/fleet/page.tsx` | `v/[venture]/fleet/page.tsx` |
| … | … (all 21 subroutes) |
| `(admin)/actions.ts` | `v/[venture]/actions.ts` |
| `(admin)/admin-actions.ts` | `v/[venture]/admin-actions.ts` |
| `(admin)/error.tsx` | `v/[venture]/error.tsx` |
| `(admin)/loading.tsx` | `v/[venture]/loading.tsx` |

- [ ] **Step 3: Fix imports** that referenced `@/app/(admin)/actions` → `@/app/v/[venture]/actions` (grep project)

- [ ] **Step 4: `npm run build`** — fix any broken imports

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(command-center): move admin routes under /v/[venture]"
```

---

## Task 0.3: Portfolio dashboard at `/`

**Files:**
- Create: `src/app/page.tsx` (staff portfolio — may conflict with existing root; replace carefully)
- Create: `src/components/PortfolioDashboard.tsx`

- [ ] **Step 1: Implement portfolio page**

Server component: `getActiveVentures()`, render card grid (name, description, color accent, link to `/v/{slug}`). Single-venture case: still show one card (redirect handled in middleware, not here).

- [ ] **Step 2: Root layout** — ensure `/` is **not** inside venture layout (no Sidebar on portfolio, OR use a minimal `CommandCenterShell` with links to Teams/Scripts/Settings only — **owner pick:** minimal shell recommended).

- [ ] **Step 3: Build + commit**

---

## Task 0.4: Sidebar venture prefix

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Add props** `ventureSlug`, `ventureName`, `ventureColor?`

- [ ] **Step 2: Prefix all nav hrefs**

```ts
const base = `/v/${ventureSlug}`;
// e.g. { href: `${base}/fleet`, label: "Fleet Vehicles", ... }
```

- [ ] **Step 3: Add global section** (disabled links OK until Phase 1/2):

```ts
{ label: "Command Center", items: [
  { href: "/", label: "Portfolio", icon: LayoutGrid },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/scripts", label: "Scripts", icon: FileCode },
  { href: "/settings", label: "Settings", icon: Settings },
]}
```

- [ ] **Step 4: Show venture name** in sidebar header with color accent bar

- [ ] **Step 5: Commit**

---

## Task 0.5: Middleware — venture guard + solo redirect

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Allow public paths** unchanged (`/forms`, `/login`)

- [ ] **Step 2: Partner rules** unchanged (`/partner` only)

- [ ] **Step 3: Staff paths**

- `/`, `/teams`, `/scripts`, `/settings` — allowed
- `/v/:slug/*` — allowed (layout validates slug)
- Legacy root admin paths — rely on `next.config` redirects (Task 0.6)

- [ ] **Step 4: Solo-venture redirect** (optional per owner decision)

After auth, if `pathname === "/"` and `activeVentures.length === 1`, redirect to `/v/tmmt-rentals`.  
Implementation note: middleware cannot easily query DB without latency — **v1 shortcut:** hardcode redirect when only `tmmt-rentals` exists, or skip redirect and always show portfolio.

- [ ] **Step 5: Post-login destination**

Staff: `/` (portfolio). Partner: `/partner` (unchanged).

- [ ] **Step 6: Commit**

---

## Task 0.6: Permanent redirects for legacy URLs

**Files:**
- Modify: `next.config.ts`
- Create: `e2e/venture-routes.spec.ts`

**Redirect table** (source → destination):

| Legacy path | New path |
|-------------|----------|
| `/fleet` | `/v/tmmt-rentals/fleet` |
| `/leads` | `/v/tmmt-rentals/leads` |
| `/customers` | `/v/tmmt-rentals/customers` |
| `/payments` | `/v/tmmt-rentals/payments` |
| `/background-checks` | `/v/tmmt-rentals/background-checks` |
| `/waitlist` | `/v/tmmt-rentals/waitlist` |
| `/appointments` | `/v/tmmt-rentals/appointments` |
| `/former-customers` | `/v/tmmt-rentals/former-customers` |
| `/do-not-rent` | `/v/tmmt-rentals/do-not-rent` |
| `/inspections` | `/v/tmmt-rentals/inspections` |
| `/maintenance` | `/v/tmmt-rentals/maintenance` |
| `/insurance` | `/v/tmmt-rentals/insurance` |
| `/tickets` | `/v/tmmt-rentals/tickets` |
| `/expenses` | `/v/tmmt-rentals/expenses` |
| `/contracts` | `/v/tmmt-rentals/contracts` |
| `/vendors` | `/v/tmmt-rentals/vendors` |
| `/operation-costs` | `/v/tmmt-rentals/operation-costs` |
| `/interfaces/appointments` | `/v/tmmt-rentals/interfaces/appointments` |
| `/interfaces/contracts` | `/v/tmmt-rentals/interfaces/contracts` |
| `/interfaces/vehicles` | `/v/tmmt-rentals/interfaces/vehicles` |
| `/interfaces/payments` | `/v/tmmt-rentals/interfaces/payments` |

> Root `/` is the **new** portfolio, not a redirect target for old dashboard bookmarks. Old dashboard bookmarks should use `/v/tmmt-rentals`.

- [ ] **Step 1: Add `redirects()` in `next.config.ts`** — `permanent: true` (308)

- [ ] **Step 2: Playwright tests** — unauthenticated redirect tests stay; add authenticated staff test (requires `E2E_STAFF_EMAIL` / `E2E_STAFF_PASSWORD` env):

```ts
test("legacy /fleet redirects to venture path", async ({ page }) => {
  // login as staff …
  await page.goto("/fleet");
  await expect(page).toHaveURL(/\/v\/tmmt-rentals\/fleet/);
});
```

- [ ] **Step 3: `npm run build` + `npm run test:e2e`**

- [ ] **Step 4: Commit**

---

## Task 0.7: Phase 0 acceptance checklist

- [ ] All 22 admin pages load at `/v/tmmt-rentals/...`
- [ ] All legacy paths 308 to new URLs
- [ ] Partner portal unaffected (`/partner`)
- [ ] All 9 public forms still work (`/forms/*`)
- [ ] Login/logout works; staff lands on portfolio or venture per decision
- [ ] `ventures` row exists for `tmmt-rentals`
- [ ] No references to `(admin)/` remain in codebase
- [ ] Update `CLAUDE.md` route diagram and `docs/ARCHITECTURE.md` (short delta section)

**Phase 0 commit message (final):**

```bash
git commit -m "feat(command-center): Phase 0 — venture routes, portfolio home, legacy redirects"
```

---

# Phase 1 — Teams + workspaces

**Estimate:** 2–3 days  
**Depends on:** Phase 0  
**Ship gate:** Create team, add note/link/message, view in UI

---

## Task 1.1: Database migration

**Files:**
- Create: `supabase/migrations/20260518120000_command_center_teams.sql`

Tables per spec: `teams`, `venture_teams`, `team_members`, `team_notes`, `team_links`, `team_messages`.

RLS: `is_staff()` full access on all (v1). Policies mirror `ventures`.

- [ ] Apply migration
- [ ] Seed one team: `slug: 'ops-core'`, name: `TMMT Ops Core`, link to `tmmt-rentals` via `venture_teams`

---

## Task 1.2: Queries + server actions

**Files:**
- Create: `src/lib/queries/teams.ts`
- Create: `src/app/teams/team-actions.ts`

Functions:
- `listTeams()`, `getTeamBySlug(slug)`
- `createTeamNote`, `updateTeamNote`, `createTeamLink`, `recordLinkClick`, `appendTeamMessage`
- `addTeamMember` (manual user_id for v1)

Use `createSSRClient()` + `getUser()` for `author_id`.

---

## Task 1.3: UI — index + detail tabs

**Files:**
- Create: `src/app/teams/page.tsx` — table/cards of teams
- Create: `src/app/teams/[slug]/page.tsx` — tabbed UI
- Create: `src/components/teams/TeamTabs.tsx` (client)

Tabs:
1. **Notes** — list + markdown editor (reuse patterns from admin modals)
2. **Links** — list + add form; clicking link calls `recordLinkClick` then opens URL
3. **Message log** — reverse-chronological append-only feed + textarea submit
4. **People** — member list + add by email (lookup `auth.users` via service role or manual UUID v1)

Layout: use a lightweight shell with sidebar link back to portfolio (not venture Sidebar).

- [ ] Build passes
- [ ] Manual QA on all four tabs
- [ ] Commit

---

## Task 1.4: Phase 1 acceptance

- [ ] `/teams` lists seeded team
- [ ] `/teams/ops-core` CRUD on notes, links, messages
- [ ] Sidebar "Teams" link works from venture pages (opens global teams, OK for v1)
- [ ] Partners cannot access `/teams` (middleware 403 or redirect)

---

# Phase 2 — Scripts library

**Estimate:** 2–4 days  
**Depends on:** Phase 0 (staff auth + nav)  
**Ship gate:** Seed library indexed; `/scripts` search returns known file

---

## Task 2.1: On-disk `scripts-library/`

**Location:** `~/Desktop/AIX_Command_Center/scripts-library/` (monorepo root, sibling to `TMMT MANAGEMENT`)

- [ ] Create folder tree: `airtable/`, `cursor/`, `claude/`, `vscode/` per spec
- [ ] Add `scripts-library/README.md` — meta.json convention, naming rules
- [ ] Copy seed files:
  - `TMMT MANAGEMENT/AUTOMATIONS/SCRIPTS/*` → `airtable/automations/` or `claude/` by type
  - `TMMT MANAGEMENT/AI_BRAIN/PROMPTS/*` → `claude/prompts/`
- [ ] Add `.meta.json` sidecar for each seeded file

---

## Task 2.2: Sync script + npm script

**Files:**
- Create: `scripts/sync-scripts-library.mjs`
- Modify: `package.json` — `"scripts:sync": "node scripts/sync-scripts-library.mjs"`

Behavior:
- Env `SCRIPTS_LIBRARY_ROOT` default `../../scripts-library` relative to repo OR absolute path
- Walk tree; skip `*.meta.json` as primary files; pair meta with script
- SHA-256 content hash; upsert `script_library_items`; soft-delete missing paths
- Use `SUPABASE_SERVICE_ROLE_KEY`

- [ ] Dry-run flag `--dry-run`
- [ ] Commit

---

## Task 2.3: `script_library_items` migration

**Files:**
- Create: `supabase/migrations/20260519120000_script_library_items.sql`

Include GIN indexes from spec. RLS: staff read; service role for sync script (bypasses RLS) or policy for staff insert/update.

---

## Task 2.4: `/scripts` UI

**Files:**
- Create: `src/app/scripts/page.tsx` — search, source filter, tag filter
- Create: `src/app/scripts/actions.ts` — `getScriptBody(relPath)`, `copyToClipboard` server helper
- Create: `src/lib/scripts-library.ts`

Features (v1):
- Search via Supabase `textSearch` or `ilike` on title/description
- Row: title, language pill, last used, Copy button
- Detail drawer/page: code block, Copy, Open in editor (`cursor://file/...` or `vscode://file/...` — **Mac paths only**, document limitation)
- Favorites: `user_script_favorites` table **optional** — defer to Phase 5 if timeboxed; else simple `localStorage` favorites

- [ ] Run `npm run scripts:sync`
- [ ] Verify ≥7 items indexed from seed
- [ ] Commit

---

## Task 2.5: Phase 2 acceptance

- [ ] New script file on disk → sync → appears in UI within one command
- [ ] Removed file → soft-deleted in index
- [ ] Find `daily_command_center` in &lt;10s from `/scripts`
- [ ] Optional: git pre-commit hook in `scripts-library/` (document in README, not required for ship)

---

# Phase 3 — Ventures #2 and #3 + runbook

**Estimate:** Ongoing (½ day mechanical per venture once runbook exists)  
**Depends on:** Phase 0

---

## Task 3.1: Pick ventures

Candidates from `AIX_Command_Center/` seedlings (owner choice):

| Slug (proposed) | Source folder | Notes |
|-----------------|---------------|-------|
| `credit-corp` | `credit_business_corporate_system/` | Likely placeholder pages first |
| `all-in-one` | `all_in_one_platform/` | May share patterns with rentals |

- [ ] Owner confirms two slugs + display names
- [ ] Insert `ventures` rows (`paused` until pages exist)

---

## Task 3.2: Runbook document

**Files:**
- Create: `docs/superpowers/runbooks/add-a-venture.md`

Checklist:
1. Insert `ventures` row
2. Decide schema strategy (rental clone vs new tables vs external Supabase)
3. Scaffold `src/app/v/[venture]/` pages (or shared template)
4. Add sidebar widget config
5. Link teams via `venture_teams`
6. Update portfolio cards
7. Smoke test + redirect rules if any shared paths

- [ ] Review with owner before executing venture #2

---

## Task 3.3: Phase 3 acceptance

- [ ] Two additional ventures visible on portfolio (even if "Coming soon" stub pages)
- [ ] Runbook committed and followed once end-to-end

---

# Phase 4 — Backup pipeline

**Estimate:** 1–2 days  
**Depends on:** Phase 2 (`scripts-library/` exists)  
**Ship gate:** One dry-run bundle on disk with `BUNDLE_INFO.md`

---

## Task 4.1: Folder conventions

- [ ] Create `~/AIX_Backup_Staging/` (operator machine)
- [ ] Create `~/AIX_Game_Library/` (empty, documented as manual-only)
- [ ] Document in runbook or spec appendix (no new top-level README unless owner asks)

---

## Task 4.2: Manifest + bundle script

**Files:**
- Create: `backup.manifest.json`
- Create: `scripts/prepare-nas-bundle.mjs`

Default manifest includes:
- `TMMT MANAGEMENT/` (exclude `node_modules`, `.next`, `.git/objects`)
- `scripts-library/`
- `tmmt-os/` (optional flag)
- `credit_business_corporate_system/` (optional)

Steps in script:
1. Timestamp dir under `~/AIX_Backup_Staging/`
2. `rsync` each manifest entry with excludes
3. `pg_dump` if `DATABASE_URL` or Supabase connection string in `.env` (fail gracefully with warning if missing)
4. Copy `scripts-library/`
5. Write `BUNDLE_INFO.md` (date, `git rev-parse` per included repo, sizes)

- [ ] `npm run backup` → `node scripts/prepare-nas-bundle.mjs`
- [ ] `npm run backup:to-flash -- /Volumes/YOUR_DRIVE` copies latest staging folder

---

## Task 4.3: NAS-side script

**Files:**
- Create: `scripts/backup-to-nas.sh`

Moves dated bundle to `NAS:/AIX_Backups/YYYY/` (path configurable via env `NAS_BACKUP_ROOT`). Includes `shasum -a256` verification pass.

---

## Task 4.4: Phase 4 acceptance

- [ ] Dry run completes &lt;5 minutes for code-only tree (owner machine)
- [ ] `BUNDLE_INFO.md` lists git SHAs
- [ ] Game library path never included
- [ ] Operator walkthrough: flash copy + NAS script documented

---

# Phase 5 — Polish (backlog, not scheduled)

Track in `docs/ROADMAP.md` only until owner prioritizes:

- Per-team ACL (non-owner accounts)
- Mirror script bodies to Supabase Storage for offline browse
- Portfolio KPI widgets per venture
- Slack webhook on new `team_messages`
- Postgres schema-per-venture when &gt;3 ventures
- Merge or link `tmmt-os` portals under command center shell

---

# Cross-cutting: docs + agent context updates

After each phase ships, update:

| File | What to add |
|------|-------------|
| `CLAUDE.md` | Route map, new commands (`scripts:sync`, `backup`) |
| `docs/ARCHITECTURE.md` | Venture + command center diagram |
| `docs/ROADMAP.md` | Phase checkboxes |
| `docs/STATUS.md` | Shipped vs planned |
| `docs/DATABASE-SCHEMA.md` | New tables (ventures, teams*, script_library_items) |

---

# Risk register (implementation)

| Risk | Mitigation in this plan |
|------|---------------------------|
| Broken bookmarks to `/fleet` etc. | Task 0.6 permanent redirects + E2E |
| Partner users hitting venture routes | Middleware unchanged for partner tier |
| `admin-actions` import paths | Task 0.2 grep + build |
| Scripts UI without local disk | Phase 2 documents Mac-only "Open in editor"; Phase 5 Storage mirror |
| Middleware DB call for solo-redirect | Hardcode or skip in v1 (Task 0.5) |
| Scope creep (chat, notifications) | Explicit non-goals; message log only |

---

# Suggested execution order

1. **Owner reviews this plan** — confirm decisions table + Phase 0 solo-redirect behavior  
2. **Phase 0** — single PR, deploy to preview, run E2E  
3. **Phase 1** — teams (usable immediately for ops notes)  
4. **Phase 2** — scripts (high daily value)  
5. **Phase 4** — backup (can parallelize after 2.1 folder exists)  
6. **Phase 3** — when second venture is chosen  

Phases 1 and 4 can swap if backup urgency is higher than teams.

---

# Review checklist for Taha

- [ ] Approve venture slug `tmmt-rentals` and display name  
- [ ] Portfolio at `/` vs auto-redirect to rentals when alone  
- [ ] `tmmt-os` included in backup manifest?  
- [ ] First two non-rental ventures to formalize (Phase 3)  
- [ ] Favorites in scripts: `localStorage` OK for v1?  
- [ ] Approve Phase 0 start (highest risk PR)

*Plan status: **Draft — pending owner review** (2026-05-17)*
