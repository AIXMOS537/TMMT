# Fathom to GHL Client Transcript Automation

Goal: when a Fathom meeting transcript is ready, automatically send the transcript to the correct client through GoHighLevel.

Recommended first build: **Fathom -> Zapier -> Google Docs/Drive -> LeadConnector/GHL -> GHL email workflow**.

This avoids pasting very long transcripts directly into GHL fields and gives the client a clean transcript link.

---

## Required Accounts

- Fathom AI connected to the calendar/meeting platform
- Zapier connected to Fathom
- Zapier connected to **LeadConnector** (this is GoHighLevel's Zapier app name)
- Google Docs or Google Drive connected to Zapier
- GoHighLevel email sending already working for the location

---

## GHL Setup

Create these Contact custom fields in GHL:

| Field | Type | Purpose |
|---|---|---|
| `fathom_last_meeting_title` | Text | Meeting name |
| `fathom_last_meeting_date` | Text or Date | Meeting date |
| `fathom_last_summary` | Large text | Short summary from Fathom |
| `fathom_last_transcript_url` | Text/URL | Google Doc, Drive file, or Fathom transcript link |
| `fathom_last_recording_url` | Text/URL | Optional recording link |
| `auto_send_meeting_transcripts` | Checkbox or Text | Only send when this is enabled/yes |

Create this GHL tag:

```text
fathom-transcript-ready
```

---

## Zapier Build

### Zap Name

```text
Fathom -> GHL Client Transcript Sender
```

### Step 1 - Trigger

App: **Fathom**

Event:

```text
New Transcript
```

If your Fathom account does not expose the transcript body in this trigger, use:

```text
New AI Summary
```

and include the transcript/recording link instead.

### Step 2 - Filter

Only continue when:

- Attendee/client email exists
- Email does not belong to your internal team
- Meeting was not marked internal/private
- Optional: meeting title does not contain `internal`, `team`, `training`, or `admin`

### Step 3 - Create Client Transcript Doc

App: **Google Docs** or **Google Drive**

Action:

```text
Create Document from Text
```

Document title:

```text
{{Client Name}} - Meeting Transcript - {{Meeting Date}}
```

Document body:

```text
Meeting: {{Meeting Title}}
Date: {{Meeting Date}}

Summary:
{{Fathom AI Summary}}

Action Items:
{{Fathom Action Items}}

Transcript:
{{Fathom Transcript}}
```

Set sharing so the client can open the document from the email link. If the transcript contains sensitive information, use restricted access and confirm the client email before sending.

### Step 4 - Find Contact in GHL

App: **LeadConnector**

Action:

```text
Find Contact
```

Search by:

```text
Client attendee email
```

If no contact is found, either:

- stop the Zap and notify you, or
- create the contact only if the attendee email is clearly the client.

### Step 5 - Update Contact Fields

App: **LeadConnector**

Action:

```text
Update Contact
```

Map:

| GHL Field | Zapier Value |
|---|---|
| `fathom_last_meeting_title` | Fathom meeting title |
| `fathom_last_meeting_date` | Fathom meeting date |
| `fathom_last_summary` | Fathom summary |
| `fathom_last_transcript_url` | Google Doc/Drive link |
| `fathom_last_recording_url` | Fathom recording URL, if available |

### Step 6 - Add Trigger Tag

App: **LeadConnector**

Action:

```text
Add Tag to Contact
```

Tag:

```text
fathom-transcript-ready
```

---

## GHL Workflow Build

Workflow name:

```text
Client - Send Fathom Meeting Transcript
```

Trigger:

```text
Contact Tag Added: fathom-transcript-ready
```

Filters:

- Contact has email
- `auto_send_meeting_transcripts` is yes/checked
- `fathom_last_transcript_url` is not empty

Actions:

1. Wait 2 minutes
2. Send Email
3. Remove tag `fathom-transcript-ready`
4. Optional: create internal task `Confirm transcript sent`

### Email Template

Subject:

```text
Your meeting transcript
```

Body:

```text
Hi {{contact.first_name}},

Here is the transcript from our recent meeting:

{{contact.fathom_last_transcript_url}}

Quick summary:
{{contact.fathom_last_summary}}

If anything needs to be corrected or clarified, just reply to this email.

Thank you,
TMMT
```

Use GHL's field picker for the real merge fields. Do not type merge fields manually if GHL shows different names.

---

## Safety Rules

- Do not send transcripts for internal/team meetings.
- Do not send transcripts to every attendee automatically.
- Send to the matched GHL client contact only.
- For credit repair, funding, legal, financial, or sensitive calls, use a review step before sending.
- If the transcript includes private third-party information, send a summary first and review before sharing the full transcript.

Recommended tag for review-needed calls:

```text
fathom-transcript-review-needed
```

---

## Production n8n Version

Use n8n when you want stronger control:

```text
Fathom webhook -> n8n -> verify/signature -> find external attendee -> find GHL contact -> create transcript doc -> update GHL -> trigger GHL workflow
```

Use this route if Zapier cannot reliably identify the correct client email or if you need transcript approval gates.

---

## Test Plan

1. Create a test GHL contact with your own email.
2. Turn on `auto_send_meeting_transcripts` for that test contact.
3. Run a 2 minute Fathom test meeting.
4. Confirm Zapier receives `New Transcript`.
5. Confirm Google Doc/Drive file is created.
6. Confirm GHL contact fields are updated.
7. Confirm GHL tag is added.
8. Confirm GHL email sends to the test contact.
9. Confirm the tag is removed after sending.
10. Only then turn it on for real clients.

