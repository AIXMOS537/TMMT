---
name: tmmt-ops-command
description: >-
  Assign and update TMMT OS work from natural language — staff (ClickUp + case),
  vendors, CRM approve, ledger/billing, case status. Use when the user wants to
  assign work, give orders, triage queue, or "just talk" to run operations without
  opening multiple apps.
---

# TMMT Ops Command

One API runs all assignment types. Prefer this over clicking through TMMT OS + ClickUp separately.

## When to use

User says things like:

- "assign Maria to case TMMT-ABC123"
- "approve CRM for renter@email.com"
- "post $45 to renter@email.com show billing"
- "what's pending"
- "assign vendor Detail Pro to case …"

## How to execute (Cursor chat)

1. Read `OPS_COMMAND_SECRET` from project `.env.local` (or ask user once).
2. POST to production (or local dev):

```bash
curl -sS -X POST "https://tmmt-ops.vercel.app/api/ops/command" \
  -H "Authorization: Bearer ${OPS_COMMAND_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"message":"USER_MESSAGE_HERE"}'
```

3. Parse JSON `results[]` and report each `message` + `links` to the user.
4. On parse failure, retry with explicit `commands` JSON (see `src/lib/ops-command/types.ts`).

Local dev: `http://localhost:3000/api/ops/command` (staff cookie works without bearer if user is logged in; bearer is for headless).

## Structured commands (when NL parse fails)

```json
{
  "commands": [
    {
      "action": "assign_staff",
      "assignee_email": "maria@tmmtrentals.net",
      "case_ref": "TMMT-ABC123",
      "title": "Follow up pickup"
    }
  ]
}
```

| action | purpose |
|--------|---------|
| `summary` | Pending CRM, blocked cases, open count |
| `assign_staff` | Case → task_assignment + ClickUp task + assignee |
| `assign_vendor` | Vendor job offer on case |
| `advance_case` | Change case status |
| `approve_sync` | CRM verify by email or sync_record_id |
| `post_ledger` | Renter billing line (optional visible_to_client) |

## Phone / in-app

User can open **TMMT OS → Command** (`/internal/assistant`) and type the same sentences.

## Prerequisites

- Supabase migration `0009_ops_command.sql` (assigned_to, clickup fields on cases)
- `OPS_COMMAND_SECRET` in Vercel + `.env.local`
- ClickUp: `CLICKUP_API_TOKEN`, `CLICKUP_TEAM_ID`, `CLICKUP_DEFAULT_LIST_ID` for staff assignee resolution

## Do not

- Manually edit ClickUp and TMMT OS separately if one command can do both.
- Guess case refs — ask or run `summary` first.
