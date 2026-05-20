# GHL workflows — TMMT portal + OpenPhone

TMMT OS automatically writes these **contact custom fields** when a case is created or updated:

| GHL field key | Filled with |
|---------------|-------------|
| `tmmt_case_ref` | Case reference (e.g. `C-8F2A9B1C`) |
| `tmmt_track_url` | Full `/track?ref=…` link |
| `tmmt_portal_url` | Client updates hub |
| `tmmt_portal_login_url` | Login page |

Create them in **GHL → Settings → Custom Fields → Contact** (Text). Keys must match unless you override in env:

```bash
GHL_CF_CASE_REF_KEY=tmmt_case_ref
GHL_CF_TRACK_URL_KEY=tmmt_track_url
GHL_CF_PORTAL_URL_KEY=tmmt_portal_url
GHL_CF_LOGIN_URL_KEY=tmmt_portal_login_url
```

Requires `GHL_API_KEY` + `GHL_LOCATION_ID` with **contacts.write** scope.

---

## Workflow 1 — Portal alert (build first)

- **Trigger:** Tag added → `tmmt-portal-alert`
- **Wait:** 1 minute
- **SMS (OpenPhone):**

```
Hi {{contact.first_name}},

TMMT update — check the portal before calling.

Ref: {{contact.tmmt_case_ref}}
Track: {{contact.tmmt_track_url}}
Portal: {{contact.tmmt_portal_url}}

Reply only if urgent.
— TMMT
```

- **Email subject:** `TMMT update — {{contact.tmmt_case_ref}}`
- **Email body:** Use HTML with links `{{contact.tmmt_track_url}}` and `{{contact.tmmt_portal_url}}`
- **Remove tag:** `tmmt-portal-alert`

---

## Workflow 2 — Status tags (optional)

One workflow per tag, or multiple triggers. **Remove the trigger tag** after SMS.

| Tag | Short SMS idea |
|-----|----------------|
| `tmmt-case-vendor-in-progress` | Work in progress on {{contact.tmmt_case_ref}} — {{contact.tmmt_track_url}} |
| `tmmt-case-customer-follow-up` | We need something from you — {{contact.tmmt_portal_url}} |
| `tmmt-case-completed` | {{contact.tmmt_case_ref}} is complete. Thanks! |
| `tmmt-portal-team-message` | New message from TMMT — {{contact.tmmt_portal_url}} |

Full list of case tags: `tmmt-case-intake-submitted`, `tmmt-case-initial-contact-needed`, … `tmmt-case-closed` (underscores → hyphens).

---

## Workflow 3 — Rental pipeline tags

| Tag | When |
|-----|------|
| `tmmt-payment-pending` | Payment due before pickup |
| `tmmt-booked` | Rental confirmed |
| `tmmt-pickup-scheduled` | Pickup soon |
| `tmmt-active-rental` | On rent |
| `tmmt-return-due` | Return approaching |
| `tmmt-returned` | Vehicle returned |

Remove each tag after the workflow runs.

---

## Env (Vercel)

```bash
GHL_API_KEY=
GHL_LOCATION_ID=
NEXT_PUBLIC_PORTAL_URL=https://tmmt-c919-two.vercel.app
GHL_PORTAL_NOTIFY=workflow
# After workflows tested, optional direct API send (usually pick ONE approach):
# GHL_PORTAL_NOTIFY=sms,email
# GHL_EMAIL_FROM=you@yourdomain.com
# NEXT_PUBLIC_URGENT_PHONE=+1XXXXXXXXXX
```

---

## OpenPhone + Google

1. Connect OpenPhone under **GHL → Settings → Phone**.
2. Use the same contact **email** as portal login and `/track`.
3. Send email from GHL with your Google-connected domain — no Resend needed.

---

## Team habits

1. **Post update to client** on internal case detail.
2. **Advance status in TMMT OS** (not only in GHL).
3. Tell customers: check **{{contact.tmmt_track_url}}** before calling.
