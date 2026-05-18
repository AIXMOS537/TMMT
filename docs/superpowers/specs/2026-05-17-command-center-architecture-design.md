# Command Center Architecture — Design Spec

**Date:** 2026-05-17
**Status:** Draft — pending owner review
**Author:** Planning pass with Taha

---

## Overview

Today TMMT MANAGEMENT is a single-tenant Next.js app for car rental ops. This spec extends it into a **portfolio command center** for up to ~50 separate ventures, with TMMT Rentals as the first (and proving-ground) venture.

The command center adds four capabilities on top of the existing app:

1. **Ventures** — a top-level concept so the app can host many businesses without each one needing its own deploy
2. **Per-team workspaces** — each team inside a venture gets a page with notes, links, and a lightweight message log (not real-time chat)
3. **Scripts library** — a single browsable index of every Airtable, Cursor, Claude, and VS Code snippet you keep, backed by an on-disk folder tree that syncs both ways
4. **Backup pipeline** — disciplined folder conventions and a bundle script that prepares everything for the flash-drive → 60 TB NAS round trip, with code and game libraries kept separate

The existing TMMT Rentals admin pages keep working exactly as they do today. They become "Venture: TMMT Rentals" inside the new shell.

---

## Goals & Non-Goals

### Goals

- One app, one deploy, one auth — hosts many ventures
- Add a venture without writing new framework code (data + light config only)
- Every team-related artifact (notes, links, decisions, message log) lives in the command center, not scattered across Notion/Slack/Drive
- Every reusable script you've collected is discoverable, copy-pasteable, and version-controlled
- A backup pass produces a portable, dated bundle ready to drop onto a flash drive

### Non-Goals (explicitly out of scope, at least for now)

- Real-time chat with presence/typing indicators — message logs are append-only
- Per-venture custom domains or per-venture Supabase projects
- Public marketing sites for each venture
- Mobile apps
- Replacing tools you actually like — Slack, GHL, Airtable, etc. stay as-is; the command center just centralizes the views/notes you keep about them

---

## Current State (so the deltas are honest)

- `src/app/(admin)/` — 17 admin pages, all single-tenant TMMT Rentals
- `src/app/(auth)/` — login
- `src/app/forms/` — 8 public intake forms
- Supabase: 44 tables, RLS enabled, all rental-specific
- Sidebar in `src/components/Sidebar.tsx` — flat list, no concept of "which venture am I in"
- On-disk scripts already exist in `TMMT MANAGEMENT/AUTOMATIONS/SCRIPTS/`, `TMMT MANAGEMENT/AI_BRAIN/PROMPTS/`, and at least one peer app (`AIX_Command_Center/all_in_one_platform`) outside TMMT
- `AIX_Command_Center/` is the parent on disk and already contains several seedling apps (`agents/`, `ops/`, `all_in_one_platform/`, `credit_business_corporate_system/`, etc.) — those are the "50 ventures" today, mostly in plan form

The command center reuses the existing Next.js app, the existing Supabase project, and the existing auth. No new infra in v1.

---

## Architecture

### 1. Ventures — the new top-level concept

A **venture** is one business. TMMT Rentals is venture #1. Each future business is venture #N.

A venture has:
- A short slug (`tmmt-rentals`, `credit-corp`, etc.) used in URLs
- A display name, color/logo for the sidebar
- A short description
- A status (`active`, `paused`, `archived`)
- An owner (you, for now — multi-owner can come later)
- A pinned dashboard layout (which widgets show first)

#### URL structure

```
/                                    → Portfolio dashboard (all ventures at a glance)
/v/tmmt-rentals                      → TMMT Rentals home (today's "/")
/v/tmmt-rentals/customers            → existing customer admin page
/v/tmmt-rentals/fleet
/v/tmmt-rentals/...                  → all existing admin pages move under /v/tmmt-rentals/*
/v/credit-corp                       → next venture
/teams/<team-slug>                   → cross-venture team page (a team can serve multiple ventures)
/scripts                             → global scripts library
/settings                            → global settings (ventures, teams, integrations)
```

Existing `(admin)/` route group is renamed/moved under `(venture)/v/[venture]/*`. This is the biggest one-time mechanical change and the only piece that touches every existing admin page. The page bodies don't change — just their location and the addition of `params.venture` they don't have to use.

#### Default venture redirect

`/` shows the portfolio dashboard. A user who only has one active venture is redirected to `/v/<slug>` so daily use feels identical to today.

### 2. Per-team workspaces

A **team** is a group of people doing work — could be your VAs, a contractor team for one venture, a cross-venture finance team, etc. Teams are not tied to a single venture; the join is many-to-many.

Each team page has four tabs:

- **Notes** — markdown notes, append-only with edit history
- **Links** — pinned external URLs (Slack channel, GHL pipeline, Airtable base, shared Drive folder, the team's Zoom room, etc.) with tags and last-clicked timestamps
- **Message log** — append-only entries you (or a VA) type in to record decisions, status updates, "fyi" notes. No replies, no real-time, no notifications. Think a captain's log per team. Solves "where did we say we'd do X?" without trying to replace Slack.
- **People** — who's on the team, contact info, role

Permissions in v1: any authenticated user can see/edit any team. Per-team ACL is a v2 addition once you actually have non-owner accounts.

### 3. Scripts library

A unified, searchable, copy-paste-ready index of every snippet you keep across four tools.

**On-disk source of truth:**

```
AIX_Command_Center/
  scripts-library/                ← new top-level folder, gitignored from individual venture repos
    airtable/
      automations/
        send-overdue-reminder.js
        send-overdue-reminder.meta.json
      formulas/
      scripting-block/
    cursor/
      rules/
      snippets/
    claude/
      prompts/
      agents/
      skills/
    vscode/
      snippets/
      tasks/
    README.md                     ← convention doc
```

Each script gets a sibling `*.meta.json` with `{ title, description, tags, category, language, last_used, notes }`. Sync is one-way + bidirectional read:

- **Filesystem is source of truth.** A sync script (`scripts/sync-scripts-library.mjs`) walks the tree, hashes each file, and upserts metadata into a Supabase table `script_library_items`. Removed files get soft-deleted in Supabase.
- **UI reads from Supabase** for search/browse, but the "Open in editor" and "Copy raw" buttons fetch from a server action that reads the live filesystem (or pre-signed URL into Supabase Storage if you decide to mirror raw contents — v2).

**UI: `/scripts`**

- Sidebar filter by source (Airtable / Cursor / Claude / VS Code) and by tag
- Full-text search across titles + descriptions + body (Postgres `tsvector` on the metadata table)
- Result rows show title, language pill, last-used date, and a "Copy" button
- Click a row → detail view with rendered body in a code block, "Copy", "Open in editor" (uses `cursor://` or `vscode://` URI), and the script's tags/notes
- "Add to favorites" pins to the top of the page

**Why both UI and folders:** the folders are what survives — they live in git, they sync to NAS, they work without the app running. The UI is what makes 200+ scripts actually findable.

### 4. NAS + flash drive backup workflow

Goal: at any time you can plug in a flash drive, run one command, and walk away with a complete, dated bundle ready to drop onto the 60 TB NAS.

**Folder conventions (on your Mac):**

```
~/Desktop/AIX_Command_Center/        ← live working tree (already exists)
  scripts-library/                   ← from §3
  TMMT MANAGEMENT/                   ← this repo
  <other ventures>/
~/AIX_Backup_Staging/                ← new — bundle prep area, ignored by Time Machine
~/AIX_Game_Library/                  ← new — game files only, never bundled with code
```

**Bundle script: `scripts/prepare-nas-bundle.mjs`** (added to TMMT MANAGEMENT initially, can be hoisted to AIX_Command_Center root later)

What it does:
1. Reads a manifest (`backup.manifest.json`) listing what to include
2. Creates `~/AIX_Backup_Staging/YYYY-MM-DD-HHMM/`
3. Copies code (excluding `node_modules`, `.next`, `dist`, `.git/objects` if you want a slim copy, etc.) using rsync
4. Exports a fresh Supabase logical dump per venture (via `pg_dump` with the connection string from `.env`)
5. Copies the `scripts-library/` tree verbatim
6. Writes a `BUNDLE_INFO.md` with date, git SHAs per repo, row counts per database, total size
7. Optionally tars + compresses the whole staging dir

**Flash drive step (manual, one prompt):**
- Plug in flash drive
- `npm run backup:to-flash -- /Volumes/<drive-name>` copies the latest bundle to the drive

**NAS step (you, at home):**
- Plug flash drive into NAS or Mac at home
- Run the included `backup-to-nas.sh` (on the NAS, or via SMB mount) which moves the dated folder into `NAS:/AIX_Backups/YYYY/` and verifies hashes

**Games stay separate.** `~/AIX_Game_Library` is never touched by the backup script. Games go to NAS via their own manual copy when you choose, so a routine code backup is never bloated by a 100 GB game.

---

## Data Model

New Supabase tables (all RLS-enabled, authenticated-only for v1):

```sql
-- Ventures
create table ventures (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  color text,                       -- hex for sidebar accent
  logo_url text,
  status text not null default 'active'    -- active | paused | archived
    check (status in ('active','paused','archived')),
  pinned_widgets jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- Teams (not tied to a single venture)
create table teams (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  created_at timestamptz default now()
);

create table venture_teams (
  venture_id uuid references ventures(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  primary key (venture_id, team_id)
);

create table team_members (
  team_id uuid references teams(id) on delete cascade,
  user_id uuid not null,            -- supabase auth.users.id
  role text default 'member',       -- member | lead | owner
  primary key (team_id, user_id)
);

create table team_notes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  author_id uuid not null,
  title text,
  body_md text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table team_links (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  label text not null,
  url text not null,
  tags text[] default '{}',
  last_clicked_at timestamptz,
  created_at timestamptz default now()
);

create table team_messages (             -- append-only captain's log
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  author_id uuid not null,
  body text not null,
  posted_at timestamptz default now()
);

-- Scripts library (filesystem is source of truth; this table is the index)
create table script_library_items (
  id uuid primary key default gen_random_uuid(),
  source text not null              -- airtable | cursor | claude | vscode
    check (source in ('airtable','cursor','claude','vscode')),
  category text,                    -- e.g. automations, formulas, prompts, snippets
  rel_path text unique not null,    -- relative path from scripts-library/
  title text not null,
  description text,
  language text,                    -- js, ts, md, py, sql, etc.
  tags text[] default '{}',
  content_sha256 text not null,
  last_used_at timestamptz,
  notes text,
  deleted_at timestamptz,           -- soft-delete when file is removed from disk
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on script_library_items using gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(notes,'')));
create index on script_library_items (source);
create index on script_library_items using gin (tags);
```

**Backfill for existing TMMT Rentals data:** insert a row into `ventures` with `slug = 'tmmt-rentals'` during the migration. The 44 existing rental tables don't need a `venture_id` column — they belong to the rentals venture by virtue of being in the rentals-specific tables. Future ventures get their own tables (or a shared schema if the venture is similar to an existing one). No multi-tenancy gymnastics on data you already have.

---

## Phased Rollout

Each phase ships independently and leaves the app in a working state. Phase 0 is the only one with mechanical risk; everything after is additive.

### Phase 0 — Foundation restructure (1–2 days)
- Move `src/app/(admin)/*` under `src/app/(venture)/v/[venture]/*`
- Add `ventures` table + seed `tmmt-rentals` row
- Add `/` portfolio dashboard (placeholder with a single venture card for now)
- Update sidebar to show "TMMT Rentals" header and current venture context
- Redirect logic: solo-venture users land on `/v/tmmt-rentals` automatically
- Build verifies, smoke E2E passes
- **Acceptance:** every existing admin URL works at its new `/v/tmmt-rentals/...` path; old URLs 308-redirect

### Phase 1 — Teams + workspaces (2–3 days)
- All 6 new `teams*` tables + RLS
- `/teams` index page, `/teams/[slug]` detail with Notes / Links / Message Log / People tabs
- Server actions for note/link/message create + edit
- Sidebar gets a "Teams" section listing teams visible to the current user

### Phase 2 — Scripts library (2–4 days)
- `scripts-library/` folder created at AIX_Command_Center root with the four source folders and a `README.md` convention doc
- Sync script `scripts/sync-scripts-library.mjs` + `npm run scripts:sync`
- `script_library_items` table + RLS
- `/scripts` page with search, filters, copy, "Open in editor" via `cursor://`/`vscode://`
- Bulk import of whatever's already in `TMMT MANAGEMENT/AUTOMATIONS/SCRIPTS/` and `AI_BRAIN/PROMPTS/` to seed the library

### Phase 3 — Adding ventures #2 and #3 (ongoing)
- Pick the next two ventures to formalize from the existing AIX_Command_Center seedlings
- For each: create the `ventures` row, decide if it shares the TMMT Supabase project or gets its own, scaffold whatever pages are needed
- Document the "add a new venture" runbook so it's a checklist, not a story

### Phase 4 — Backup pipeline (1–2 days)
- `~/AIX_Backup_Staging/` and `~/AIX_Game_Library/` conventions documented
- `scripts/prepare-nas-bundle.mjs` + `backup.manifest.json`
- `npm run backup` and `npm run backup:to-flash`
- `backup-to-nas.sh` for the NAS-side step
- One full dry run end-to-end before declaring it done

### Phase 5 — Polish (open-ended)
- Per-team ACL once you have non-owner accounts
- Raw script body mirrored to Supabase Storage so the UI works without local filesystem access (useful when you're on the MacBook Pro at a coffee shop)
- Portfolio dashboard widgets per venture (KPIs, AR, fleet utilization, etc.)
- Optional: Slack webhook so new `team_messages` post to a Slack channel for teams that want real-time

---

## Open Questions

1. **One Supabase project or one per venture?** v1 says one. Lower cost, simpler auth, shared `auth.users` table. Risk: schema sprawl. Mitigation: each venture gets its own Postgres schema (`tmmt`, `credit_corp`, …) inside the same project once you cross ~3 ventures.
2. **Who else gets logins?** Today it's all-or-nothing. Per-team ACL is queued for Phase 5 but depends on you actually wanting your VAs/contractors in this app vs. keeping them in GHL/Slack.
3. **Scripts library — store raw content in Supabase too?** v1 says no, filesystem only. If you want to browse from the MacBook Pro while traveling without the AIX_Command_Center folder mounted, we mirror to Supabase Storage in Phase 5.
4. **Bundle format — tar.gz or plain folder?** Plain folder is faster to verify and partially restore; tar.gz is smaller and one-file-clean for the flash drive. Recommend plain folder on the staging dir, tar.gz when copying to flash.
5. **Game library on the NAS — same drive partition or separate share?** Recommend a separate NAS share (`/Games/`) so backup permissions and quotas stay clean.

---

## Risks

- **Phase 0 URL change touches every existing admin page.** Mitigation: 308 redirects from old paths, a Playwright sweep that hits every old URL and asserts it lands on the new one.
- **Scripts library can rot fast** if you add to disk but skip the sync step. Mitigation: a git pre-commit hook in the AIX_Command_Center scripts-library folder that runs the sync.
- **NAS becomes a single point of failure** for 50 ventures' worth of code + data. Mitigation: keep GitHub as the source of truth for every venture's repo; the NAS bundle is a convenience archive, not the only copy.
- **Scope creep into "build my own Slack."** Mitigation: this spec deliberately picks append-only message log, not chat. Push back hard on "but can it also do…" until Phase 5.

---

## Success Criteria

- TMMT Rentals daily work is unchanged in feel (same pages, same auth, same data)
- Adding the second venture takes less than half a day of mechanical work
- You can find any of your scripts in under 10 seconds from `/scripts`
- A backup bundle for everything in AIX_Command_Center can be produced in a single command and copied to a flash drive in under 5 minutes
