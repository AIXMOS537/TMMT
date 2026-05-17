# Command Agent Implementation Plan

## Target Outcome

One agent receives commands from messaging apps, routes work by business, creates tasks, updates CRM records, logs actions, and replies with confirmation.

## System Roles

| System | Role |
|---|---|
| GoHighLevel | CRM, contacts, pipelines, campaigns, customer conversations |
| ClickUp | Task execution, assignees, due dates, project boards |
| Supabase | Main structured database and command/action log |
| Airtable | Lightweight operational views and manual-friendly tables |
| n8n | Main automation engine and webhook router |
| Zapier | Fast connector fallback when n8n connector is missing |
| Slack | Credit repair/business funding team communication |
| Telegram | Owner command channel |
| WhatsApp | Owner/customer messaging, ideally through GHL or Twilio |
| iMessage | Quick capture through Apple Shortcuts or local Mac relay |

## MVP Architecture

```text
Messaging Apps
  -> n8n Webhook: /command-router
  -> Normalize message
  -> Classify business and intent
  -> Create action plan
  -> Approval gate if needed
  -> Execute integrations
  -> Log to Supabase
  -> Reply to sender
```

## n8n Workflow Nodes

1. Webhook Trigger: receives all commands.
2. Normalize Input: maps Telegram, Slack, GHL, WhatsApp, and iMessage payloads into one schema.
3. Classify Command: uses rules first, AI second.
4. Business Router: TMMT Rentals, Ecommerce, or Credit Education.
5. Intent Router: task, lead, follow-up, note, message draft, money entry, content request.
6. Approval Check: decides if action can run automatically.
7. Execution Nodes:
   - ClickUp: create task.
   - GoHighLevel: create/update contact, opportunity, note, task.
   - Slack: post internal message.
   - Supabase: insert command/action log.
   - Airtable: optional mirrored record.
8. Reply Node: sends confirmation back to the original channel.

## Supabase Tables

### command_log

| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| created_at | timestamp | Default now |
| source_channel | text | telegram, slack, ghl, whatsapp, imessage |
| sender_id | text | Original sender |
| business | text | tmmt_rentals, ecommerce, credit_education |
| command_text | text | Raw command |
| detected_intent | text | create_task, follow_up, create_lead, etc. |
| status | text | received, executed, needs_approval, failed |
| approval_required | boolean | True/false |
| response_text | text | Confirmation sent back |

### agent_tasks

| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| created_at | timestamp | Default now |
| business | text | Business unit |
| title | text | Task title |
| description | text | Details |
| priority | text | low, medium, high, urgent |
| due_at | timestamp | Due date/time |
| assignee | text | Owner/team member |
| status | text | new, assigned, in_progress, done |
| clickup_task_id | text | Returned by ClickUp |
| ghl_contact_id | text | Optional |
| source_command_id | uuid | Links to command_log |

## Business Defaults

| Business | ClickUp Space/List | GHL Pipeline | Slack Channel |
|---|---|---|---|
| TMMT Rentals | TMMT Operations | Rentals Pipeline | Optional |
| Ecommerce | Ecommerce Ops | Ecommerce Leads | Optional |
| Credit Education | Credit Education Ops | Credit/Funding Pipeline | Credit team channel |

## Build Order

1. Create Supabase tables.
2. Create one n8n webhook called `command-router`.
3. Connect Telegram bot to the webhook.
4. Connect Slack slash command or event trigger for credit business.
5. Add ClickUp create-task action.
6. Add GoHighLevel contact/task update action.
7. Add Supabase logging.
8. Add confirmation replies.
9. Add approval workflow for message sending.
10. Add WhatsApp and iMessage after the command core works.

## Human Approval Gate

Use this rule inside n8n:

```text
If action touches customers, money, legal/compliance, or credit/funding promises, ask for approval before sending or changing final status.
```

Approval message example:

```text
Approval needed:
Send this message to Jasmine?

"Hey Jasmine, I can send over the business funding readiness checklist. It is educational and does not guarantee approval, but it will help you see what lenders usually review."

Reply YES to send or EDIT with changes.
```

## First Workflow To Build

Start with Telegram to ClickUp:

```text
Telegram message -> n8n webhook -> classify -> create ClickUp task -> log in Supabase -> reply to Telegram
```

This proves the agent can receive, decide, assign, log, and confirm.

