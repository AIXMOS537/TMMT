# Multi-Channel Command Router

## Goal

Send a command from WhatsApp, Telegram, iMessage, Slack, GoHighLevel chat, or another messaging app. The agent reads the command, identifies the business, decides the task type, creates the right task, assigns it, and triggers the right workflow.

## Plain English Version

You say:

```text
Add follow-up for John about credit funding checklist tomorrow 10am
```

The system should:

1. Detect business: Credit Education.
2. Detect action: create follow-up task.
3. Detect person: John.
4. Detect date/time: tomorrow 10am.
5. Create or update the lead in GoHighLevel.
6. Create a task in ClickUp.
7. Post a notice in the Slack credit channel.
8. Save the record in Supabase or Airtable.
9. Reply back to you: "Done. Follow-up created."

## Command Channels

| Channel | Best Use | Recommended Route |
|---|---|---|
| GoHighLevel | Leads, customers, campaigns, pipeline moves | GHL webhook to n8n |
| WhatsApp | Fast owner commands and customer conversations | GHL WhatsApp or Twilio webhook to n8n |
| Telegram | Owner command center | Telegram Bot webhook to n8n |
| iMessage | Personal quick capture | Shortcut or Mac relay to webhook |
| Slack | Credit repair business team execution | Slack app slash command/event to n8n |
| Email | Documents, receipts, customer requests | Zapier/n8n email parser |

## Core Rule

Every channel should send commands to one master webhook:

```text
POST /command-router
```

That webhook normalizes every message into the same task format.

## Standard Command Format

```json
{
  "source_channel": "telegram",
  "sender": "owner",
  "business": "credit_education",
  "command_text": "Follow up with John tomorrow at 10am about funding checklist",
  "detected_intent": "create_task",
  "priority": "high",
  "due_at": "2026-05-17T10:00:00-04:00",
  "assignee": "owner",
  "approval_required": false
}
```

## Business Routing

| Business | Keywords | Default Systems |
|---|---|---|
| TMMT Rentals | rental, car, fleet, booking, renter, pickup, return, maintenance | GoHighLevel, ClickUp, Supabase, Airtable |
| Ecommerce | product, order, customer, supplier, ad, Shopify, store, tracking | ClickUp, Airtable, Supabase, Zapier/n8n |
| Credit Education | credit, funding, tradeline, business credit, dispute, bureau, checklist, course | GoHighLevel, Slack, ClickUp, Supabase |

## Intent Routing

| Intent | Example | Action |
|---|---|---|
| create_task | "Remind me to call Sarah tomorrow" | Create ClickUp task |
| create_lead | "New lead Mike wants funding help" | Create GHL contact/opportunity |
| follow_up | "Follow up with James Friday" | Create GHL task + ClickUp task |
| send_message_draft | "Draft a reply to this customer" | Draft only, ask approval |
| move_pipeline | "Move Alicia to booked" | Update GHL opportunity, log action |
| create_content | "Make 3 posts about credit utilization" | Create ClickUp content tasks |
| save_note | "Note: customer prefers morning pickup" | Save note to CRM/database |
| money_entry | "Log $250 rental payment" | Save finance record, approval if needed |

## Approval Rules

The agent can do these automatically:

- Create tasks.
- Save notes.
- Add leads.
- Draft messages.
- Post internal Slack updates.
- Create reminders.

The agent must ask before:

- Sending customer-facing messages.
- Charging/refunding money.
- Deleting records.
- Changing legal/compliance documents.
- Making credit repair or funding promises.
- Moving a deal to closed/won if money was not verified.

## Recommended MVP

Build only these first:

1. Telegram owner command bot.
2. Slack credit business command channel.
3. GoHighLevel inbound webhook.
4. n8n command-router workflow.
5. ClickUp task creation.
6. Supabase command log.

After this works, add WhatsApp, iMessage, Zapier, and Airtable sync.

## Example Commands

```text
TMMT: follow up with Chris about rental pickup tomorrow 9am high priority
```

```text
ECOM: create task to write 5 product descriptions for waist trainer offer due Monday
```

```text
CREDIT: add lead Jasmine interested in business funding education, follow up Friday
```

```text
CREDIT: draft a Slack update for the team about today's new leads
```

```text
Log expense TMMT $45 car wash today
```

