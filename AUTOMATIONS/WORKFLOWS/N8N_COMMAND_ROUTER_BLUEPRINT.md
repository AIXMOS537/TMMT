# n8n Command Router Blueprint

This is the first workflow to build in n8n.

## Workflow Name

```text
Command Router - Owner Commands To Tasks
```

## Trigger

Create a webhook trigger:

```text
POST /command-router
```

## Step 1: Normalize Input

Create a Set or Code node that outputs:

```json
{
  "source_channel": "={{$json.source_channel || 'manual'}}",
  "sender_id": "={{$json.sender_id || $json.user_id || $json.from?.id || 'unknown'}}",
  "sender_name": "={{$json.sender_name || $json.user_name || $json.from?.first_name || 'Unknown'}}",
  "command_text": "={{$json.message_text || $json.text || $json.body || $json.message || ''}}"
}
```

## Step 2: Business Classifier

Use rules first:

| If Command Contains | Business |
|---|---|
| TMMT, rental, car, fleet, booking, pickup, return | tmmt_rentals |
| ECOM, ecommerce, product, order, supplier, store, Shopify | ecommerce |
| CREDIT, credit, funding, bureau, dispute, tradeline, business credit | credit_education |

If no match, set:

```text
business = unknown
```

and reply asking which business it belongs to.

## Step 3: Intent Classifier

| If Command Contains | Intent |
|---|---|
| follow up, call, remind | follow_up |
| add lead, new lead | create_lead |
| create task, todo, assign | create_task |
| draft, write reply, respond | send_message_draft |
| log expense, log income, payment | money_entry |
| post, content, caption, script | create_content |
| note, remember | save_note |

## Step 4: Approval Gate

Set `approval_required = true` if command includes:

```text
send, charge, refund, delete, guarantee, dispute, legal, contract, approval, remove, close won
```

Also require approval for:

- Customer-facing messages.
- Money movement.
- Legal/compliance language.
- Credit repair or funding promises.

## Step 5: Route Actions

### Always

- Insert row into Supabase `command_log`.

### If Task Or Follow-Up

- Create ClickUp task.
- Insert row into Supabase `agent_tasks`.

### If Credit Education

- Post internal Slack update.
- If lead-related, create/update GoHighLevel contact.

### If TMMT Rentals

- Create/update GoHighLevel contact/opportunity/task.
- Create ClickUp task.

### If Ecommerce

- Create ClickUp task.
- Optionally sync product/content record to Airtable.

## Step 6: Reply Back

Reply to the original source channel:

```text
Done: created [task/lead/follow-up] for [business].
Assigned to: [assignee].
Due: [due date].
Approval required: [yes/no].
```

## First Test

Send this to the webhook:

```json
{
  "source_channel": "telegram",
  "sender_id": "owner",
  "sender_name": "Owner",
  "message_text": "TMMT: follow up with Chris about rental pickup tomorrow 9am high priority"
}
```

Expected result:

- Business: `tmmt_rentals`
- Intent: `follow_up`
- Priority: `high`
- Creates ClickUp task
- Logs command to Supabase
- Replies with confirmation

