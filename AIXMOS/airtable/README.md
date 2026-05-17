# AIXMOS Operations Base — Airtable setup for your assistant + Omni

This folder gives you a ready-to-import Airtable base: people onboarding, content inventory, weekly ops, and GHL link tracking — tuned for **Airtable Omni** so your assistant can ask questions and get work done in plain English.

## Quick start (≈20 minutes)

1. In Airtable: **Create base** → **Start from scratch** → name it **AIXMOS Operations**.
2. For each table below, **Import CSV** from this folder (`csv/`).
3. After import, fix field types (see [Field types after import](#field-types-after-import)).
4. Add **linked records** between tables (see [Link tables](#link-tables)).
5. Paste **Omni base instructions** from `omni/BASE-INSTRUCTIONS.md` into Airtable Omni settings.
6. Paste **field descriptions** from `omni/FIELD-DESCRIPTIONS.md` (or per-table in field config).
7. Create **Interfaces** for your assistant (see [Interfaces for assistant](#interfaces-for-assistant)).
8. Share base: **Creator** or **Editor** for assistant; **Commenter** only if she should not edit logins.

---

## Tables (4 + optional 5th)

| Table | Purpose |
|-------|---------|
| **People** | Everyone who gets a login (employee, partner, client, investor) |
| **Content Assets** | Training files, SOPs, vault items — what exists vs “coming soon” |
| **Tasks** | Day-to-day work Omni and assistant can create/close |
| **Weekly Reports** | Friday snapshot for you (Omni can draft from other tables) |
| **GHL & Links** *(optional)* | Placeholder URLs from site/portal until Muhammad provides real links |

Import order: **People** → **Content Assets** → **GHL & Links** → **Tasks** → **Weekly Reports**  
(Tasks and Weekly Reports reference other tables — link after all exist.)

---

## Field types after import

Airtable may import everything as text. Convert these columns:

### People

| Field | Type |
|-------|------|
| Person Type | Single select |
| System | Single select |
| Portal Role | Single select |
| Status | Single select |
| Email | Email |
| Login URL | URL |
| Portal Password | Single line text |
| Sync to Portal | Checkbox |
| Portal Synced At | Date |
| Temp Password Sent | Checkbox |
| Vault Reviewed | Checkbox |
| Day-1 Call Done | Checkbox |
| Approved Date | Date |
| Muhammad Approved | Checkbox |

**Single select options — Person Type:** `Employee`, `Partner`, `Client`, `Investor`  
**System:** `AIXMOS Portal`, `TMMT Rentals`, `Both`  
**Portal Role:** `admin`, `executive`, `operator`, `member`, `partner`, `pending`  
**Status:** `Approved - Pending Setup`, `Login Created`, `Welcome Sent`, `Day-1 Call Scheduled`, `Day-1 Call Done`, `Active`, `Paused`, `Exited`

### Content Assets

| Field | Type |
|-------|------|
| Audience | Single select: `Employee`, `Partner`, `Client`, `Investor`, `All staff` |
| Format | Single select: `PDF`, `Video`, `HTML`, `DOC`, `Other` |
| Status | Single select: `Missing`, `Draft`, `Ready`, `Linked in Portal` |
| Priority | Single select: `P0`, `P1`, `P2` |
| Owner | Single select: `Muhammad`, `Assistant`, `Vendor` |
| Blocks Onboarding | Checkbox |

### Tasks

| Field | Type |
|-------|------|
| Status | Single select: `To do`, `In progress`, `Blocked`, `Done` |
| Priority | Single select: `Urgent`, `High`, `Normal`, `Low` |
| Due Date | Date |
| Task Type | Single select: `Onboarding`, `Content`, `GHL/Links`, `Weekly ops`, `Other` |

### Weekly Reports

| Field | Type |
|-------|------|
| Week Ending | Date |
| Status | Single select: `Draft`, `Sent to Muhammad` |

### GHL & Links

| Field | Type |
|-------|------|
| Status | Single select: `Placeholder`, `URL received`, `Live on site` |
| Used On | Single select: `Landing`, `Portal`, `GHL workflow`, `Email` |

---

## Link tables

1. **Tasks** → add field **Person** (Link to **People**, allow multiple off).
2. **Tasks** → add field **Content Asset** (Link to **Content Assets**, optional).
3. **Weekly Reports** → add field **Related Tasks** (Link to **Tasks**, allow multiple).
4. Optional: **Content Assets** → **Primary audience role** as single select only (no link needed).

Delete CSV helper columns after linking if you imported `Person Email` / `Asset Name` as text — or keep for Omni search.

---

## Interfaces for assistant

Create one Interface per workflow (Airtable **Interfaces** → **Add interface**):

### 1. Assistant Home
- **People**: Gallery or List — filter `Status` is not `Active` and not `Exited` → “Needs attention”
- **Tasks**: Kanban by `Status` — filter `Assignee` = assistant (or all open)
- Button linked record: open person → complete onboarding checklist

### 2. Onboarding queue
- **People** table view: `Status` = `Approved - Pending Setup` OR `Login Created` OR `Welcome Sent`
- Sort: `Approved Date` ascending
- Fields visible: Name, Person Type, Portal Role, Email, Status, Notes

### 3. Content vault
- **Content Assets**: Grid grouped by `Status`
- Filter: `Blocks Onboarding` = checked AND `Status` ≠ `Linked in Portal`
- Group by `Audience`

### 4. Friday report
- **Weekly Reports**: form to add new week
- Omni drafts bullets (see prompts below)

---

## Automations (optional)

| Trigger | Action |
|---------|--------|
| People `Status` → `Approved - Pending Setup` | Create Task: “Create login + send welcome” (Due: today) |
| People `Status` → `Welcome Sent` | Create Task: “Schedule Day-1 call” (Due: +2 days) |
| Content `Status` → `Ready` | Create Task: “Link in portal or notify Muhammad” |
| Weekly Reports created | Email Muhammad (or Slack) with summary field |

---

## Views to create (non-Interface)

**People**
- `🔴 Stuck onboarding` — Status not in Active, Exited, Day-1 Call Done
- `✅ Active users` — Status = Active
- `By type` — Group by Person Type

**Content Assets**
- `🚧 Blocks onboarding` — Blocks Onboarding + not Linked
- `📋 Needs Muhammad` — Owner = Muhammad AND Status = Draft or Missing
- `Ready to link` — Status = Ready

**Tasks**
- `Today` — Due Date is today, Status ≠ Done
- `Blocked` — Status = Blocked

---

## Portal / NAS reference (for assistant)

When linking content or creating logins:

| Person Type | AIXMOS Portal Role | TMMT |
|-------------|-------------------|------|
| Employee | `executive` | `admin` or `va` in Supabase |
| Partner (operator) | `operator` | — |
| Partner (fleet) | — | `partner` + fleet access |
| Client | `member` | — |
| Investor | `admin` or future `investor` | — |

**NAS folders:** `/share/AIXMOS/training-videos/`, `operator-sops/`, `member-resources/`, `admin-only/`  
**Portal file:** `AIXMOS/portal/index.html` — `USERS` array + `renderVault()` paths

---

## Files in this folder

```
airtable/
├── README.md                 ← you are here
├── omni/
│   ├── BASE-INSTRUCTIONS.md  ← paste into Omni
│   └── PROMPTS.md            ← copy-paste prompts for assistant
└── csv/
    ├── People.csv
    ├── Content_Assets.csv
    ├── Tasks.csv
    ├── Weekly_Reports.csv
    └── GHL_Links.csv
```

---

## Portal sync (Airtable → login file)

After your assistant updates **People** in Airtable:

1. Row must have: **Sync to Portal** ✓, **Portal Password**, **Status** ≥ `Login Created`, **System** = AIXMOS Portal or Both, valid **Portal Role**.
2. From repo root:

```bash
export AIRTABLE_PAT=patYourTokenHere
# optional: export AIRTABLE_BASE_ID=appXXXXXXXX
npm run sync:aixmos-people
```

3. Writes `AIXMOS/portal/data/users.json` (gitignored). Portal loads it on sign-in.
4. Copy that file to NAS `/share/AIXMOS/portal/data/users.json` if hosting on UGREEN.

Automation recipes: **`AUTOMATIONS.md`**. Dry run: `npm run sync:aixmos-people -- --dry-run`

---

## Security

- **Portal Password** in Airtable is for sync only — rotate after first login; never commit `users.json`.
- Use **Temp Password Sent** (checkbox) + deliver via Signal/1Password.
- Restrict investor rows with Airtable **locked views** or separate base if needed.
- Base is operational, not customer CRM — GHL remains source for pipeline.
