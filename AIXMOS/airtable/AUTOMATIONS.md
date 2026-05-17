# Airtable automations — AIXMOS Operations

Set these up in the **AIXMOS Operations** base after CSV import and field types are correct. Automations cannot run the sync script on your NAS; they keep data ready so **one command** (`npm run sync:aixmos-people`) updates the portal.

---

## Required fields (add if missing)

| Table | Field | Type | Purpose |
|-------|--------|------|---------|
| People | **Sync to Portal** | Checkbox | Include row in `users.json` when checked |
| People | **Portal Password** | Single line text | Temp password (rotate after first login) |
| People | **Portal Synced At** | Date (optional) | Last successful sync timestamp |

---

## Automation 1 — Ready for portal login

**When:** Record in **People** matches all:
- `Status` is `Approved - Pending Setup`
- `Muhammad Approved` is checked
- `System` is `AIXMOS Portal` or `Both`

**Actions:**
1. Update record → `Status` = `Login Created`
2. Check `Sync to Portal`
3. Create record in **Tasks** → Title: `Create portal login + run sync`, Type: `Onboarding`, Due: today, Priority: `Urgent`, link **Person**

**Notify:** Email Muhammad (or Slack): *"New portal user ready: [Name] — add Portal Password and run sync."*

---

## Automation 2 — Welcome sent → Day-1 call

**When:** `Status` changes to `Welcome Sent`

**Actions:**
1. Create **Task**: `Schedule Day-1 Training Vault call` — Due +2 days — link Person
2. Update **People** → uncheck nothing; optional set `Day-1 Call Scheduled` when task created manually

---

## Automation 3 — Blocked on Muhammad

**When:** **Tasks** `Status` = `Blocked` for more than 2 days

**Actions:**
1. Send email to Muhammad with task name + Notes + linked Person

---

## Automation 4 — Friday reminder (assistant)

**When:** Every Friday 9:00 AM (workspace timezone)

**Actions:**
1. Send email to assistant: *"Run Omni Friday report prompt and update Weekly Reports table."*

---

## Automation 5 — Content blocks onboarding

**When:** **Content Assets** — `Blocks Onboarding` checked AND `Status` = `Missing`

**Actions:**
1. Create **Task** — Title: `Unblock onboarding: [Asset Name]` — Owner Assistant — link Content Asset — Priority `High`

---

## Automation 6 — GHL placeholder aging

**When:** **GHL & Links** — `Status` = `Placeholder` AND record created > 7 days ago

**Actions:**
1. Create **Task** for Muhammad: `Provide URL for [Link Name]`

---

## Sync workflow (human + script)

```text
Assistant                          Muhammad / you
─────────                          ──────────────
1. Muhammad approves person
2. Automation → Login Created + Sync to Portal ✓
3. Fill Portal Password in Airtable (secure channel)
4. Slack: "ready to sync"
                                   5. npm run sync:aixmos-people
                                   6. Optional: set Portal Synced At
7. Send welcome email with portal URL
8. Day-1 call → Vault walkthrough
```

### Commands

```bash
# From repo root — loads AIRTABLE_PAT from environment
export AIRTABLE_PAT=patxxxx   # or source .env
npm run sync:aixmos-people

# Preview without writing file
npm run sync:aixmos-people -- --dry-run
```

Output: `AIXMOS/portal/data/users.json` (gitignored). Portal loads this on login.

---

## Omni + automations

After automations run, assistant asks Omni:

```
List People where Sync to Portal is checked but Status is Login Created and Portal Password is empty.
```

That is the daily "waiting on password / sync" queue.

---

## Optional: Zapier / Make (true hands-off sync)

If you want sync without running npm manually:

1. **Trigger:** Airtable — People — `Sync to Portal` checked  
2. **Filter:** `Portal Password` is not empty  
3. **Action:** Webhook to a tiny CI job or NAS cron that runs `sync-airtable-people.mjs` and reloads nginx  

Not included in repo — use when volume exceeds ~5 new users/week.
