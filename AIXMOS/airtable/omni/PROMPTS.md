# Omni prompts — copy for your assistant

She can paste these into **Omni** chat inside the AIXMOS Operations base. Save favorites in Airtable Omni if your plan supports saved prompts.

---

## Daily start

```
What should I work on today? Use People stuck in onboarding, Tasks due today or overdue, and Content Assets that block onboarding. Give me a numbered list with record names and what to do for each.
```

---

## New person approved (Muhammad said yes)

```
Muhammad approved [FULL NAME] as [Employee / Partner / Client / Investor]. Email: [email@domain.com]. System: [AIXMOS Portal / TMMT Rentals / Both].

1. Create or update their People record with the right Person Type, Portal Role, and Status "Approved - Pending Setup".
2. Create Tasks: (a) Create login, (b) Send welcome email, (c) Schedule Day-1 call — due dates today, tomorrow, and +2 days.
3. Draft the welcome message (CHUMMO voice) with portal URL placeholder [PORTAL_URL] — do not invent a password; say Muhammad will provide or use secure channel.
```

---

## Friday report

```
Draft this week's Weekly Report for Muhammad. Week ending [DATE].

Include:
- New People records this week and their Status
- Anyone stuck in onboarding more than 7 days
- Content Assets still Missing or Draft with Blocks Onboarding
- GHL & Links still Placeholder
- Top 3 tasks for next week

Write Summary as bullet points ready to paste. Set Weekly Reports Status to Draft.
```

---

## Content audit

```
Audit Content Assets: list every record where Status is not "Linked in Portal", grouped by Audience and Priority. For each P0 item, suggest the next action and Owner.
```

---

## Portal vault gap check

```
Compare our Content Assets to the AIXMOS portal Training Vault roles (admin, executive, operator, member). List assets we need that are not in the base yet, especially operator onboarding and investor materials.
```

---

## Stuck onboarding

```
Who is stuck? List all People where Status is not Active or Exited and Approved Date is more than 5 days ago. For each, say the next Status step and one Task to unblock.
```

---

## GHL / site links

```
List all GHL & Links with Status Placeholder. Sort by Used On. For each, write a one-line note on where it appears (landing vs portal) so Muhammad can fill URLs.
```

---

## Draft welcome email

```
For People record [NAME or paste email], draft a welcome email in CHUMMO voice. Include: portal link field, first login steps (sign in → Training Vault → first document for their role), ask them to reply "in" when logged in. Under 120 words.
```

---

## Handoff to Muhammad

```
Build a "Needs Muhammad" list: Tasks status Blocked, Content Assets Owner Muhammad not Ready, GHL & Links Placeholder marked urgent in Notes, and any People with Investor type. One bullet each with record link context.
```

---

## Ready for portal sync

```
List People where Sync to Portal is checked, System is AIXMOS Portal or Both, Status is Login Created or later, but Portal Password is empty OR Portal Synced At is empty. These need Muhammad before npm run sync:aixmos-people.
```

---

## After she completes login setup

```
Update People [NAME]: set Status to "Welcome Sent", check Temp Password Sent, mark linked Tasks done, create Task "Day-1 call" due in 2 days if not exists.
```

---

## Tips for Muhammad

- Turn on **Omni** for the base in workspace settings.
- Give assistant **Editor** + train her on these 3 prompts first: Daily start, New person approved, Friday report.
- Review **Weekly Reports** view every Friday; approve before she marks Sent to Muhammad.
