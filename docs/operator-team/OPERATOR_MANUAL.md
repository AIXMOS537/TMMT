# TMMT Rentals — Operator & Owner Manual

**Version:** v1 — 2026-05-21
**Audience:** TMMT operators (daily users) and the owner (administrator)
**Companion docs:** `START_HERE.md` (this folder), `../STATUS.md` (current feature state), `../ROADMAP.md` (what's next)

> **TL;DR — first thing to know:** The live app lives at **`https://tmmt-command-center.vercel.app`**. Sign in there. Everything else is in this manual.

---

## Part 0 — Quick reference (read this first, every day)

### Where things live

| What | URL | Who can use it |
|---|---|---|
| **Live app (the command center)** | `https://tmmt-command-center.vercel.app` | Owner + operators (authenticated) |
| Portfolio dashboard | `/` | Authenticated users — lists all ventures |
| TMMT Rentals venture | `/v/tmmt-rentals` | Operators on the rentals team |
| Login | `/login` | Everyone with an account |
| Public lead-intake form | `/forms/lead-intake` | **Share with prospective customers — no auth needed** |
| Public customer-intake form | `/forms/customer-intake` | **Share with new customers — no auth needed** ⚠️ *Currently broken in prod, see §9* |
| Other public forms | `/forms/{waitlist, appointment, inspection, onboarding-inspection, handover, license-upload, background-check, ticket}` | Share with the relevant party |
| Supabase Studio (database UI) | `https://supabase.com/dashboard/project/uapxakmlwnpfsftfeezx` | Owner only (read-write) |
| Vercel dashboard (deployments) | `https://vercel.com/<team>/tmmt-c919` | Owner only |
| GitHub repo | `https://github.com/AIXMOS537/TMMT` | Owner + any developer the owner adds |

### "Where do I go to ..." — the cheat sheet

| Goal | Path |
|---|---|
| Add a new customer | `/v/tmmt-rentals/customers` → **New** button |
| Edit a customer's info | `/v/tmmt-rentals/customers` → click the row → modal opens with fields |
| Add a vehicle to the fleet | `/v/tmmt-rentals/fleet` → **New** |
| Mark a vehicle in/out of service | `/v/tmmt-rentals/fleet` → row → toggle status |
| Log a payment received | `/v/tmmt-rentals/payments` → **New** |
| Open a maintenance ticket | `/v/tmmt-rentals/maintenance` → **New** |
| Open a customer-issue ticket | `/v/tmmt-rentals/tickets` → **New** |
| Add an appointment | `/v/tmmt-rentals/appointments` → **New** |
| Track an inspection | `/v/tmmt-rentals/inspections` → **New** |
| Add a do-not-rent flag | `/v/tmmt-rentals/do-not-rent` → **New** |
| See contracts | `/v/tmmt-rentals/contracts` |
| See leads | `/v/tmmt-rentals/leads` |
| Manage insurance records | `/v/tmmt-rentals/insurance` |
| Operating costs ledger | `/v/tmmt-rentals/operation-costs` |
| Expense entries | `/v/tmmt-rentals/expenses` |
| Vendor list | `/v/tmmt-rentals/vendors` |
| Customer waitlist | `/v/tmmt-rentals/waitlist` |
| Background check queue | `/v/tmmt-rentals/background-checks` |
| Former / archived customers | `/v/tmmt-rentals/former-customers` |
| Settings (env, integrations) | `/settings` |

### 30-second daily health check

Before starting the day, paste this into a browser to confirm the system is up:

1. `https://tmmt-command-center.vercel.app/login` → see "Sign in" form? ✅ system is alive
2. Sign in → see the Portfolio dashboard at `/` → ✅ auth works
3. Click "TMMT Rentals" → see `/v/tmmt-rentals` dashboard with KPIs → ✅ data loads

If any of these fail, see §10 "Troubleshooting" before doing anything else.

---

## Part 1 — One-time setup (per operator)

### 1.1 Get an account

The owner creates accounts in the **Supabase Auth dashboard** (`https://supabase.com/dashboard/project/uapxakmlwnpfsftfeezx/auth/users`).

For each new operator:

1. Owner → Supabase Auth → **Add user** → fill in:
   - Email
   - Temporary password (operator changes after first login)
   - **Auto-confirm user**: ON (otherwise the operator can't sign in until they click an email link)
2. If the operator needs admin powers (most operators do for daily ops): owner runs locally on a machine with the repo:
   ```bash
   cd ~/Documents/TMMT
   npm run set-admin-role -- <operator-email>
   ```
   This sets `app_metadata.role = "admin"` in Supabase. Without this role, the operator can sign in but gets bounced from admin pages.
3. Owner sends the operator their email + temp password via a secure channel (NOT Slack, NOT plain email — use 1Password share, Signal, or in person).

### 1.2 First login

1. Operator opens `https://tmmt-command-center.vercel.app/login`.
2. Enters email + temp password → submits.
3. On first sign-in, **change the temp password immediately** via the Supabase Auth UI (currently in v1 there is no in-app password change page — see §9 known issues). For now: the owner re-sets it from Supabase Studio, or the operator uses Supabase's password-reset email flow.
4. After logging in, the operator lands on `/` (Portfolio dashboard) and sees TMMT Rentals as the only active venture. Click it.

### 1.3 The sidebar — five-minute orientation

Top-level (always visible regardless of venture):

- **Portfolio** (`/`) — list of all ventures. TMMT Rentals is the only one today; new ones get added in `~/AIX-Command-Center/config/ventures.json`.
- **Teams** (`/teams`) — per-team workspaces (notes, links, message log). Use it for cross-venture team docs.
- **Scripts** (`/scripts`) — searchable index of reusable scripts (Airtable, Cursor, Claude, VS Code snippets). Adds as you populate `~/AIX-Command-Center/scripts-library/`.
- **Settings** (`/settings`) — system settings, env, integrations.

Venture-scoped (visible after picking TMMT Rentals): the 22 venture pages listed in §0's cheat sheet — Customers, Fleet, Leads, Payments, etc.

### 1.4 Roles

Five role landing pages exist for different audiences:

| Role | Landing page | Who sees it |
|---|---|---|
| Operator | `/operator` | The day-to-day rental ops team |
| Executive | `/executive` | Owner / management — strategic view |
| Investor | `/investor` | Read-only fleet + financial snapshot |
| Vendor | `/vendor` | Outside vendors (mechanics, etc.) — scoped view |
| Partner | `/partner` | Investor-style read-only with stricter scope |

These were scaffolded as foundations; real role-based gating happens via `app_metadata.role` in Supabase. Today's main role is `admin`. The non-admin landing pages exist but should be considered v0.5 until each role's scope is locked down in the May 17 spec.

---

## Part 2 — Daily workflows

These are the workflows operators actually run, day-to-day. Each is a sequence of pages and actions.

### 2.1 Lead → customer conversion

**Trigger:** A prospective customer calls, texts, or fills out `/forms/lead-intake`.

1. **If they called/texted you directly:** go to `/v/tmmt-rentals/leads` → **New** → fill in name, phone, vehicle interest, source.
2. **If they filled out the public form:** the lead lands in `leads` table automatically. Check `/v/tmmt-rentals/leads` for new rows tagged with the lead source = `form`.
3. **Qualify:** click the lead row → modal opens → update notes, set status. Move status from `new` → `contacted` → `qualified` → `converted` as you go.
4. **Convert to customer:** when ready, either (a) send them `/forms/customer-intake` to fill in or (b) click "Convert to Customer" on the lead modal (creates a `customers` row pre-filled from the lead).
5. **Run background check (if required):** `/v/tmmt-rentals/background-checks` → **New** → link to the customer record. Pending → cleared → flagged.
6. **Add to fleet bookings:** if the customer is moving to a rental, create a contract record in `/v/tmmt-rentals/contracts` linking customer + vehicle.

**Common gotcha:** if the lead has no email, the customer-intake form can't be sent. Capture an email on the lead step before trying to convert.

### 2.2 Customer onboarding → contract → handover

**Once a customer is converted:**

1. **License upload:** send the customer `/forms/license-upload` to upload their driver's license. The upload lands in `customer_documents` (Supabase Storage + DB row).
2. **Onboarding inspection:** before the vehicle leaves the lot, do the onboarding inspection at `/forms/onboarding-inspection` (operator fills this on a tablet or phone). Captures odometer, fuel, photos.
3. **Contract:** generate the contract in `/v/tmmt-rentals/contracts`. v1: contract details are entered in the admin UI; PDF generation/upload is a Tier-3 feature still being built (see ROADMAP).
4. **Handover:** the operator gives the keys and walks through the vehicle with the customer using `/forms/handover` — captures customer signature acknowledging the vehicle's condition.
5. **First payment:** log the initial payment in `/v/tmmt-rentals/payments`. Status → `received`.

**End state:** customer is in `customers` (status = `active`), has a row in `contracts` (status = `active`), has at least one payment in `payments`.

### 2.3 Returning inspection

**When the customer brings the vehicle back:**

1. Open `/v/tmmt-rentals/inspections` → **New** → select customer + vehicle.
2. Walk the vehicle: damages, fuel, odometer, photos. Capture each on the form.
3. If damage is found → also open a `/v/tmmt-rentals/tickets` entry tagged `vehicle-damage`. Link it to the inspection.
4. Update the contract status to `completed` (or `disputed` if there's damage in question).
5. Update the customer status to `inactive` (or move them to `/v/tmmt-rentals/former-customers` if they're not returning).

### 2.4 Payment tracking

**Daily reconciliation:**

1. `/v/tmmt-rentals/payments` — check rows with status = `pending` or `failed`.
2. For each: confirm whether payment landed in your processor (Stripe, GHL, ACH). If yes → mark `received`. If no → call the customer, log the touchpoint in their `customers` notes.
3. **Operating costs** (fuel cards, tolls, etc.) are in `/v/tmmt-rentals/operation-costs`. **Expenses** (rent, utilities, supplies) are in `/v/tmmt-rentals/expenses`. Don't conflate the two.

### 2.5 Maintenance triage

1. **Inbound signal:** an operator notices vehicle issue OR the inspection flagged one OR a customer reports it via `/forms/ticket`.
2. **Open the maintenance entry:** `/v/tmmt-rentals/maintenance` → **New** → vehicle, issue, priority.
3. **Assign vendor:** pick from `/v/tmmt-rentals/vendors` (or add a new one).
4. **Track status:** `scheduled` → `in-progress` → `done`. Each transition gets a date.
5. **Cost:** when the invoice arrives, log it in `/v/tmmt-rentals/operation-costs` linked to the maintenance record.

### 2.6 Ticket handling

Customer-issue or general ops tickets live in `/v/tmmt-rentals/tickets`:

1. New ticket either from the public form (`/forms/ticket`) or from an operator typing it in.
2. Triage: who owns it? Set assignee + priority + type (`vehicle-damage`, `customer-dispute`, `billing-issue`, `other`).
3. Resolve and close. Add resolution notes.

---

## Part 3 — Admin reference (per page)

For every venture page, this is what it does, who edits it, and how to add a row.

| Page | Purpose | Who writes | Add a row by |
|---|---|---|---|
| `/v/tmmt-rentals` | Venture dashboard — KPIs at a glance | (read-only display) | n/a |
| `/customers` | Active customer roster | Operators | **New** → fill modal → Save |
| `/leads` | Prospective customers | Operators + public form | **New** or auto from `/forms/lead-intake` |
| `/fleet` | Vehicle inventory | Owner + ops manager | **New** |
| `/contracts` | Rental contracts | Operators | **New**, linking customer + vehicle |
| `/payments` | Payment ledger | Operators (manual entries) + integrations | **New** |
| `/expenses` | Business expenses (non-vehicle) | Owner + accounting | **New** |
| `/operation-costs` | Vehicle-related operating costs (fuel, tolls, maintenance) | Operators | **New** |
| `/maintenance` | Vehicle maintenance log | Ops + fleet manager | **New** |
| `/inspections` | Vehicle inspections (returning) | Operators | **New** or auto from `/forms/inspection` |
| `/appointments` | Customer-facing appointments | Operators | **New** or auto from `/forms/appointment` |
| `/tickets` | Issue tracker | Operators + public form | **New** or auto from `/forms/ticket` |
| `/insurance` | Insurance policies per vehicle | Owner | **New** |
| `/vendors` | External vendors (mechanics, etc.) | Owner + ops | **New** |
| `/waitlist` | Customers waiting for vehicle availability | Operators + public form | **New** or auto from `/forms/waitlist` |
| `/background-checks` | Background-check queue + results | Operators | **New** or auto from `/forms/background-check` |
| `/do-not-rent` | Banned / flagged customers | Owner + lead operator only | **New** — add reason + flagged-by |
| `/former-customers` | Archived customer history | Auto from status change | (move from `/customers`) |
| `/interfaces/*` | Specialized read-only views of related tables (vehicles, payments, contracts, appointments) | Read-only | n/a |

**Every page follows the same pattern:**

1. Loads data via `lib/queries.ts` (read-only).
2. Renders a `DataTable` with columns + a search box.
3. Click a row → modal opens with form fields.
4. Edit fields → click **Save** → calls `adminUpsert("table_name", record)` server action.
5. Server action validates auth + table allowlist before writing to Supabase.

**This means:** any operator with `admin` role can edit any field on any record on these pages, with one click. If you want restricted writes for non-admin roles, that's a v1.5 task (per-role ACL) — see §9.

---

## Part 4 — Making updates and changes

There are **three tiers** of changes. Always use the lowest tier that solves the problem.

### Tier 1 — UI edits (the safe path, 95% of the time)

Anything that's a single record change: edit it in the admin UI.

- **Pros:** Auth-gated, validated by zod on the server, RLS-enforced, follows the audit trail.
- **Cons:** Can't do bulk changes (yet — that's a v2 import tool).
- **Who:** Any operator with admin role.
- **How:** Use the page tables above. Click → edit → Save. The server action handles everything.

### Tier 2 — Database edits via Supabase Studio (owner only, with care)

For bulk fixes, schema-spanning edits, or one-time data corrections that the UI doesn't support.

- **Pros:** Direct SQL, full power.
- **Cons:** No app-level validation, no audit log, easy to bork things.
- **Who:** Owner only. Operators should NOT have Supabase Studio access — give them a read-only role if they need to query data.
- **How:**
  1. Open `https://supabase.com/dashboard/project/uapxakmlwnpfsftfeezx`.
  2. Run SQL in the SQL editor, **with a WHERE clause and a LIMIT**.
  3. Before any `UPDATE` or `DELETE`, run the equivalent `SELECT` first to confirm the row set.
  4. Document the change in `~/Documents/TMMT/docs/sops/MANUAL_DB_EDITS.md` (create this log file the first time you do this — date, who, why, SQL).

**Hard rules for Tier 2:**

- ❌ NEVER `DELETE FROM <table>` without `WHERE`.
- ❌ NEVER `UPDATE <table> SET ...` without `WHERE`.
- ❌ NEVER edit the `auth.users` table directly — use Supabase Auth UI.
- ❌ NEVER edit migrations that have already been applied. Write a NEW migration.
- ✅ Always run a `SELECT COUNT(*) FROM <table> WHERE <your-condition>` before the destructive query.
- ✅ Always take a backup snapshot before bulk edits: Supabase Studio → Database → Backups → On-demand.

### Tier 3 — Code changes (developer only)

For new features, new pages, schema additions, bug fixes.

- **Pros:** Versioned, reviewed, tested, audited.
- **Cons:** Slowest path. Requires a developer with the repo + Vercel access.
- **Who:** Owner or any developer the owner trusts.
- **How:**
  1. Pull the repo: `cd ~/Documents/TMMT && git pull`.
  2. Make changes in a branch: `git checkout -b feat/<short-name>`.
  3. Run locally: `npm run dev` — verify at `http://localhost:3000`.
  4. Test: `npm run build && npm run test:e2e`.
  5. Commit: small focused commits with conventional messages.
  6. Push: `git push -u origin feat/<short-name>`.
  7. Open a PR against `master`. Vercel will create a preview deployment.
  8. Verify the preview deployment. Merge to `master`. Vercel auto-deploys to prod (assuming auto-deploy is connected — see §9).

**Schema changes** = a new SQL file in `supabase/migrations/`. Run with the Supabase CLI or paste into Supabase Studio's SQL editor.

### Tier flow chart

```
What you want to change:
│
├── Single record's field value? ──────────► Tier 1 (UI edit)
├── Many records, same change?  ──────────► Tier 2 (SQL with WHERE)
├── A whole table or new field? ──────────► Tier 3 (migration)
├── App behavior or layout?     ──────────► Tier 3 (code change)
└── Anyone's password?           ──────────► Supabase Auth UI (not Studio, not Tier 2)
```

### Adding a new venture (Tier 1 config — no code)

1. Create a new ClickUp list for the venture.
2. Open `~/AIX-Command-Center/config/ventures.json` (on the machine where you do ops work).
3. Add an entry: `{ slug, name, clickup_list_id, default_tag, status: "active" }`.
4. `git commit && git push` — the new venture is now visible in the Portfolio dashboard at `/` and reachable at `/v/<slug>`.
5. New venture pages reuse the same `[venture]` route group, so they get all the existing admin pages automatically.

### Adding a new operator

See §1.1. ~3 minutes of Supabase Auth UI clicks + one `npm run set-admin-role` command.

---

## Part 5 — Public forms (share with customers, prospects, etc.)

These forms are **public** (no login required). Share the URLs directly with the relevant party.

| Form | URL | When to share | Lands in |
|---|---|---|---|
| Lead intake | `/forms/lead-intake` | Prospective customer | `leads` table |
| Customer intake | `/forms/customer-intake` ⚠️ | New customer signing up | `customers` table |
| Waitlist | `/forms/waitlist` | When vehicle they want is unavailable | `waitlist` table |
| Appointment | `/forms/appointment` | Pre-rental walkthrough or pickup scheduling | `appointments` table |
| Onboarding inspection | `/forms/onboarding-inspection` | Operator-filled at vehicle pickup | `inspections` table (type=onboarding) |
| Returning inspection | `/forms/inspection` | Operator-filled at vehicle return | `inspections` table (type=returning) |
| Handover | `/forms/handover` | Customer signs at vehicle handoff | `handovers` table |
| License upload | `/forms/license-upload` | Customer uploads driver's license | `customer_documents` table + Supabase Storage |
| Background check | `/forms/background-check` | Customer fills before vehicle release | `background_checks` table |
| Ticket | `/forms/ticket` | Customer or operator reports an issue | `tickets` table |

⚠️ `customer-intake` is currently 404 in production — see §9.

**Each form is rate-limited** to 5 submissions per hour per IP via middleware. If a legitimate user gets rate-limited, the owner can clear it by restarting the Vercel deployment (or wait 60 minutes).

---

## Part 6 — Live edits to the database (the answer to your direct question)

> **Q: "Allow for any live edits to the database to be made."**

You have **three live-edit surfaces** today, in order of safety:

### 6.1 The admin UI (Tier 1 — the answer for 95% of "I need to change X right now")

Every field on every page in §3 is editable in real time. Click row → modal → edit → Save → the change is in the database in under 2 seconds.

**This is what you should use unless the change can't be done one record at a time.**

### 6.2 Supabase Studio (Tier 2 — for bulk + corrective edits)

`https://supabase.com/dashboard/project/uapxakmlwnpfsftfeezx` → SQL editor.

Used for: bulk corrections, fixing a column on many rows, cleaning up bad data after an import.

**Rules already in §4.2 — re-read them every time before clicking Run.**

### 6.3 Supabase MCP via Claude (Tier 2.5 — fast, conversational, still risky)

You already have the Supabase MCP server connected to Claude Code. From any session you can say:

> "Run `SELECT count(*) FROM customers WHERE status = 'active'`"

and Claude will execute it via the MCP tools. **This is the same risk profile as Tier 2** — it's direct SQL, no app validation, no audit log. Use the same rules. The advantage is speed for one-off questions ("how many active rentals do we have right now?") without opening Studio.

### What you should NOT do

- ❌ Build a generic "edit any table" admin page. It's a footgun: the more flexibility it has, the more damage one click can do, and you have no audit trail. The structured admin UI already covers every record-level edit.
- ❌ Let operators have Supabase Studio access. Read-only at most.
- ❌ Edit `auth.users` or any RLS policy directly without a migration.

---

## Part 7 — Smoke testing

### 7.1 Daily — 30 seconds (operators do this every morning)

See §0 "30-second daily health check." If any step fails → §10.

### 7.2 Weekly — 2 minutes (owner does this)

```bash
cd ~/Documents/TMMT
SMOKE_BASE_URL=https://tmmt-command-center.vercel.app bash scripts/smoke-prod.sh
```

Expected: `Result: 7 passed, 0 failed`. Any failure → investigate immediately.

### 7.3 Per-deployment — 5 minutes (after any code change)

After Vercel auto-deploys a new commit to `master`:

```bash
cd ~/Documents/TMMT
npm run smoke:prod
```

If it passes, optionally run the full Playwright suite against prod:

```bash
npm run test:e2e:prod
```

### 7.4 Comprehensive — 5 minutes (run quarterly or after a major release)

Paste this into a terminal — it's the wide smoke that was run when this manual was written:

```bash
for url in \
  https://tmmt-command-center.vercel.app/ \
  https://tmmt-command-center.vercel.app/login \
  https://tmmt-command-center.vercel.app/forms/appointment \
  https://tmmt-command-center.vercel.app/forms/background-check \
  https://tmmt-command-center.vercel.app/forms/customer-intake \
  https://tmmt-command-center.vercel.app/forms/handover \
  https://tmmt-command-center.vercel.app/forms/inspection \
  https://tmmt-command-center.vercel.app/forms/lead-intake \
  https://tmmt-command-center.vercel.app/forms/license-upload \
  https://tmmt-command-center.vercel.app/forms/onboarding-inspection \
  https://tmmt-command-center.vercel.app/forms/ticket \
  https://tmmt-command-center.vercel.app/forms/waitlist \
  https://tmmt-command-center.vercel.app/v/tmmt-rentals \
  https://tmmt-command-center.vercel.app/partner \
  https://tmmt-command-center.vercel.app/investor \
  https://tmmt-command-center.vercel.app/operator \
  https://tmmt-command-center.vercel.app/executive ; do
    code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 8 "$url")
    echo "$code  $url"
done
```

Expected codes:
- `200` for `/login` and `/forms/*` (public)
- `307` for `/`, `/v/...`, `/partner`, `/investor`, `/operator`, `/executive` (auth-required redirect to login)
- ❌ `404` on anything = broken page

### 7.5 Local build verification (before pushing code)

```bash
cd ~/Documents/TMMT
npm install
npm run check-env   # validates .env without printing secrets
npm run build       # this is the primary CI gate — must pass
npm run lint        # ESLint
npm run test:e2e    # local Playwright suite
```

If any of these fail locally, do NOT push.

---

## Part 8 — Common admin tasks (one-line recipes)

```bash
# Local development
npm run dev                              # start dev server on http://localhost:3000

# Verify the environment
npm run check-env                        # confirms .env + Supabase reachability

# Create a partner-test account (for partner-portal QA)
npm run create-partner-test-user

# Grant admin role to a user
npm run set-admin-role -- user@example.com

# Sync Airtable people into Supabase (one-time per import)
npm run sync:aixmos-people

# Sync this machine's repo with the canonical
npm run sync:machine                     # uses scripts/sync-machine.sh

# Run the production smoke
npm run smoke:prod
```

---

## Part 9 — Known issues + production action items

**As of 2026-05-21, these are confirmed real issues:**

### KNOWN-1: `/forms/customer-intake` returns 404 in production

- **Symptom:** `curl https://tmmt-command-center.vercel.app/forms/customer-intake` → `404`
- **Local state:** page.tsx exists in master and in the current working branch
- **Diagnosis:** the live Vercel deployment is **stale** — it was built before customer-intake was added (the page was added in commit `61f70c1`, master tip is from 2026-05-19 but the deployment is older).
- **Fix:** push to master (or trigger a manual Vercel redeploy of `master`). The owner needs to check the Vercel project's "Production" tab and either click "Redeploy" or push a new commit to master.

### KNOWN-2: DEPLOY.md references the wrong URL

- **Symptom:** `DEPLOY.md` says the Vercel project name is `tmmt-c919` but `https://tmmt-c919.vercel.app/` returns `DEPLOYMENT_NOT_FOUND`. The actual live URL is `https://tmmt-command-center.vercel.app/`.
- **Diagnosis:** the project was renamed in Vercel (or its URL alias was redirected) but the doc never got updated.
- **Fix:** update DEPLOY.md to say `tmmt-command-center.vercel.app` is the canonical URL.

### KNOWN-3: Custom domains not connected

- `https://allinonemanagementsolutions.com` → 404
- `https://allinonemanagementsolutions.net` → 404
- Both are intended (per DEPLOY.md env vars `NEXT_PUBLIC_PUBLIC_SITE_HOST` and `NEXT_PUBLIC_OWNER_HUB_HOST`) but the DNS isn't pointed at the Vercel app yet.
- **Fix:** in Vercel project Settings → Domains, add both domains and follow Vercel's DNS instructions.

### KNOWN-4: No in-app password change page

- Operators can't change their password from inside the app.
- **Workaround:** owner resets via Supabase Studio, OR the operator uses Supabase's password-reset email flow (the link is auto-sent).
- **Fix:** v1.5 — add a `/settings/password` page that hits Supabase's `updateUser` API.

### KNOWN-5: Per-role gating is not enforced (only `admin` matters today)

- The role landing pages (`/operator`, `/executive`, `/investor`, `/vendor`, `/partner`) all exist but a user with `admin` role can see every venture page regardless of which role landing they "belong to."
- **Fix:** v1.5 — per-role RLS + sidebar filtering. Until then, operators with the admin role have full access. The CLAUDE.md and ROADMAP.md track this.

---

## Part 10 — Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Can't load `/login` (timeout) | Vercel deployment is down OR DNS is broken | Check `https://vercel-status.com`. If green, check Vercel project's last build. |
| `/login` loads but sign-in fails | Wrong email/password OR Supabase Auth is down OR account not auto-confirmed | Check Supabase dashboard → Auth → Users → confirm the user. |
| Signed in but bounced from admin page back to `/login` | Missing `admin` role on the user | Owner runs `npm run set-admin-role -- user@example.com`. |
| Admin page loads but shows "Failed to load dashboard data" | Supabase query failed | Open browser dev console → Network → see the failing query. Most common: RLS policy denying read. Run as service-role in Supabase Studio to confirm data is there. |
| Form submit returns "Rate limit exceeded" | More than 5 submissions/hour from the same IP | Wait 60 min, OR owner restarts the Vercel deployment to reset the in-memory limiter. |
| `npm run build` fails locally | Usually a TypeScript error in a file you just edited | Read the error. The first error in the stack is the one to fix; later errors are cascading. |
| Production has different behavior than local | Stale Vercel deployment (see KNOWN-1) | Push to master or trigger manual redeploy. |
| Supabase Studio shows no data in a table | The table is empty OR you're looking at the wrong schema (`public` vs `auth`) | Confirm schema dropdown at top of the SQL editor. |

### Escalation

1. **First:** check this manual (especially §9 and §10).
2. **Second:** check the live status of dependencies:
   - Vercel: `https://www.vercel-status.com/`
   - Supabase: `https://status.supabase.com/`
3. **Third:** check the project Slack/Mattermost #ops channel.
4. **Last resort:** contact the owner directly.

---

## Part 11 — Appendix

### A — All routes (67 total)

Run this locally to get the current canonical list (auto-generated from the codebase):

```bash
find ~/Documents/TMMT/src/app -name "page.tsx" -o -name "route.ts" | \
  sed 's|.*/src/app|/src/app|' | sort
```

### B — Environment variables required in Vercel Production

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (https) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key — safe in browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role — server-only, NEVER ship to browser |
| `NEXT_PUBLIC_PUBLIC_SITE_HOST` | Public marketing domain (currently `allinonemanagementsolutions.com`) |
| `NEXT_PUBLIC_OWNER_HUB_HOST` | Private owner hub domain |
| `NEXT_PUBLIC_GHL_CHECKOUT_97` | GHL $97 checkout URL |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry error monitoring (optional — leave blank to disable) |
| `AIRTABLE_PAT` | Airtable PAT (only for the one-time sync script, not the running app) |

### C — Glossary

| Term | Meaning |
|---|---|
| **Venture** | One business in the portfolio. TMMT Rentals is venture #1. |
| **Tier** | Severity/safety level of a change. Tier 1 = UI edit, Tier 2 = SQL, Tier 3 = code. |
| **RLS** | Row-Level Security — Postgres policies that control who can read/write each row. |
| **Admin role** | `app_metadata.role = "admin"` on the Supabase Auth user. Required for all `/v/.../*` edits. |
| **Public form** | Any page under `/forms/*` — accessible without login, rate-limited. |
| **Portfolio dashboard** | `/` — lists all active ventures. |

### D — Useful links

- **Manual (this doc):** `~/Documents/TMMT/docs/operator-team/OPERATOR_MANUAL.md`
- **Tech architecture:** `~/Documents/TMMT/docs/ARCHITECTURE.md`
- **Database schema:** `~/Documents/TMMT/docs/DATABASE-SCHEMA.md`
- **Roadmap:** `~/Documents/TMMT/docs/ROADMAP.md`
- **Status:** `~/Documents/TMMT/docs/STATUS.md`
- **Operator playbook (PDF):** `~/Documents/TMMT/docs/operator-team/TMMT_OPERATOR_TEAM_ACTING_OWNER_PLAYBOOK.pdf`
- **SOPs:** `~/Documents/TMMT/docs/sops/`
- **Command-center spec (multi-venture):** `~/Documents/TMMT/docs/superpowers/specs/2026-05-17-command-center-architecture-design.md`
- **Brain-dump agent spec (v1):** `~/Documents/TMMT/docs/superpowers/specs/2026-05-21-brain-dump-clickup-agent-design.md`

---

**Version history:**
- 2026-05-21 — v1 written. Includes baseline smoke test results, the 3-tier edit hierarchy, all 67 routes documented, 5 known issues surfaced.
