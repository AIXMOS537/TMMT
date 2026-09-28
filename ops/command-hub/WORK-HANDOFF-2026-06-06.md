# TMMT / AIXMOS — Work Handoff (compiled 2026-06-06)

Snapshot of all new work on this Windows tablet, compiled so it can be carried to the
**Mac (the stationary "work Mac")** and continued. Goal context: stand up the
**Mission Control** system — the LLM-driven operator that runs TMMT day-to-day.

---

## ⚠️ READ FIRST — risks before you move machines

1. **✅ RESOLVED — Mission Control is now under version control.**
   `C:\Users\AIXMOS\CommandCenter\tmmt-os` is now a **local git repo** (commit `849cba0`, 433 files, **no remote / nothing pushed**, secrets excluded). The full working app + Mission Control are captured in history so they can't be lost. STILL TODO on the Mac: decide source-of-truth and reconcile with GitHub (see below) — do NOT blind-push, the GitHub branches are thin/divergent.

   ⚠️ Note: `C:\Users\AIXMOS\TMMT` (→ `github.com/Metavibez4L/TMMT`) is a **stale/minimal clone** — `master` = 1 commit / 1 migration. GitHub branches: `master` (1), `main` (9), `feat/supabase-auth` (19) — none carry the 30-migration feature set. The real app lives in `CommandCenter\tmmt-os` + USB. Figure out which branch Vercel deploys before pushing anything.

2. **✅ RESOLVED — migration collision fixed.** `0008_mission_control.sql` → `0030_mission_control.sql` (runs after 0029; no longer collides with `0008_unified_ledger_sync.sql`).

3. **Main repo has uncommitted WIP too** (separate from Mission Control):
   modified `src/app/(admin)/admin-actions.ts`, `src/components/Sidebar.tsx`, `src/lib/queries.ts`, and a new untracked `src/app/(admin)/tasks/page.tsx`. Not committed, not deployed.

4. **Telegram not wired.** No `TELEGRAM_*` token in `.env.local`. Mission Control Phase 3 (push to people) can't run until a bot token is added.

---

## 1. Mission Control  (the "LLM that runs the business")

**What it is:** every person (owner, manager, team, vendor, client) sees, live: *what's happening now*, *what they're needed for*, and *their next 1–3 growth moves* — drafted/monitored by the AIXMOS agents (VISION govern, TANK execute, FLY GUY comms, BOB log, STICKS monitor), surfaced in the TMMT OS portals, later pushed to Telegram. Full spec: `tmmt-os/docs/MISSION-CONTROL.md`.

**Built today (in `CommandCenter\tmmt-os`, ~22:17–22:29):**
- DB: `supabase/migrations/0008_mission_control.sql`
- Logic: `src/lib/mission/` → `board.ts`, `generate.ts`, `types.ts`, `notify.ts`
- API: `src/app/api/mission/generate/route.ts`
- UI: `src/components/mission/mission-board.tsx`
- Role dashboards wired: `(owner)/admin/dashboard`, `(team)/team/dashboard`, `(vendor)/vendor/dashboard`
- Notifications: `src/lib/telegram/send.ts`
- Preview (open in browser): `CommandCenter/Mission-Control-Preview.html`

**Status vs. spec:** the doc says "spec / not yet built," but Phase 1 (the in-app MissionBoard) + parts of Phase 2/3 plumbing are **already coded**. Doc is slightly behind the code.

**Live data snapshot used (pulled 2026-06-06):** 17 new leads · 2 contracting · 20 active rentals (of 40 customers) · 43 fleet · 4 maintenance due · 104 waitlist · 0 open cases · 308 tickets.

**Open decisions (from the spec):** confirm `tmmt-os` is the deployed app; supply Telegram bot token; decide if "grow moves" are agent-generated or owner-authored to start; optional voice ("what do I need to do today?").

---

## 2. Team Dashboards  (17 personalized launchers)

Role-based personal dashboards (same sleek look + voice control; each person sees only what their **role** allows). System docs: `CommandCenter/README-Dashboards.md`. Make a new one in ~30s by copying `Dashboard-Template.html` and editing the PROFILE block (name/role/subtitle).

**Roles:** owner (all) · manager · dispatch · operator · sales · family/friend/vendor (personal links only). Owner-only infra tiles (Stripe, Supabase, Vercel, GitHub, Investor) are never shown to anyone else.

**16 active + 1 removed** in `CommandCenter/TeamDashboards/`:
Aayan Khan · Abdul Ahad · Abdul Basit · Ahmed Chaudery · Areesha Ali · Asad · Claryn Troup · Dominique Bibbs · Javeria Arham · Justin Perez · Michael Bibbs · Rida Khan · Sumaima Siddiqui · Syeda Wania · Umair Shafiq · Zayed Haq.  (`_removed/Dashboard-Tyrone-Hicks.html` = off-team.)
Plus `Dashboard-Sara-Example.html` (sample) and `Dashboard-Template.html` (master).

---

## 3. Command Center (front door)

- `CEO-Dashboard.html` (owner, sees everything — don't hand out) — updated 22:29
- `Home-Command-Center.html` — personal/home launcher
- `Dashboard-Template.html` — master template
- `SYNC-BRAIN.bat` — brain/vault sync helper
- Auto-opens at login via Startup `CEO-DailyDriver.bat` → `AutoStart-DailyDriver.bat`.

---

## 4. Team-Drive onboarding kit  (`C:\Users\AIXMOS\TMMT-TEAM-DRIVE`)

Plug-and-play kit that turns any Win/Mac into a TMMT node (installs Claude Code, Node, Git, clones the repo, writes `.env` from `config/.env.public`). Updated today: `windows/bootstrap.ps1`, `windows/SETUP.bat`, `mac/setup.sh`, `mac/SETUP.command`, `README.md`, `START-HERE.txt`. Deployed to USB drives E:/F: as `TMMT-SETUP/`.

---

## 5. Recommended next steps (to continue on the Mac)

1. **Safeguard the new work first (do on this tablet):**
   - Decide the source of truth: copy the Mission Control files from `CommandCenter\tmmt-os` into the git repo `C:\Users\AIXMOS\TMMT`, fix the `0008`→`0009` collision, then `git add/commit/push`. (Confirm with owner before committing — agent-written code should get a VISION go/no-go.)
2. **On the Mac:** clone `github.com/Metavibez4L/TMMT`, `npm install`, add `.env` (service-role key only on trusted machines), run the Supabase migrations, deploy via Vercel.
3. **Wire Telegram** (bot token → `.env`) to turn on Phase 3 push.
4. **Hand out dashboards** to the 16 active team members (USB/email/desktop drop).

---

## 6. When the USB drives go back in (queued from cleanup)
- Mirror **F: → E:** so either stick is interchangeable.
- Reclaim ~5 GB by deleting the drive `_QUARANTINE-2026-06-06/` + `AIXMOS/99_ARCHIVE/` after review.
- Refresh `TMMT-SETUP/` on both sticks from `TMMT-TEAM-DRIVE` if the kit changed.

*Nothing here is deleted or committed automatically — this is a read-only compile. Say the word for any action above.*
