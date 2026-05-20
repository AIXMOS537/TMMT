# 10-minute GHL + Vercel setup checklist

Use this after deploying TMMT OS with portal + GHL sync code.

**Your production app:** `https://tmmt-ops.vercel.app` (from `NEXT_PUBLIC_PORTAL_URL`)

---

## 1. GHL custom fields (5 min)

**Settings → Custom Fields → Contact → Add field** (type: **Text**)

| Name (label) | Field key (must match) |
|--------------|------------------------|
| TMMT Case Ref | `tmmt_case_ref` |
| TMMT Track URL | `tmmt_track_url` |
| TMMT Portal URL | `tmmt_portal_url` |
| TMMT Portal Login | `tmmt_portal_login_url` |

In workflow SMS/email use merge fields: `{{contact.tmmt_case_ref}}`, `{{contact.tmmt_track_url}}`, etc.

---

## 2. GHL API token (3 min)

**Settings → Private Integrations → Create**

Scopes (minimum):

- `contacts.readonly`
- `contacts.write`
- `opportunities.readonly` / `opportunities.write` (if pipeline sync is used)
- `conversations.write` (only if you set `GHL_PORTAL_NOTIFY=sms,email` later)

Copy **API key** and **Location ID** (Sub-account → Settings → Business Profile, or from URL).

**TMMT location:** `EaRPXFwPZbqCM9pynHwt` — https://app.gohighlevel.com/v2/location/EaRPXFwPZbqCM9pynHwt/launchpad

---

## 3. Vercel env (2 min)

Project: **tmmt-ops** on Vercel.

### Already on production

- `NEXT_PUBLIC_PORTAL_URL`
- `GHL_WEBHOOK_SECRET`, `GHL_AUTO_OPS`, `GHL_PIPELINE_STAGE_MAP_JSON`
- Supabase keys

### You must add (required for custom field sync)

Run in terminal from the `tmmt-os` folder (paste real values when prompted):

```bash
npx vercel env add GHL_API_KEY production
npx vercel env add GHL_LOCATION_ID production
```

`GHL_PORTAL_NOTIFY=workflow` should be set to **workflow** (tags only; GHL automations send SMS/email).

Optional after workflows work:

```bash
npx vercel env add GHL_EMAIL_FROM production
# value: your GHL sending address, e.g. management@tmmtrentals.net
```

Then **redeploy** production (Deployments → … → Redeploy, or `npx vercel --prod`).

---

## 4. Workflow 1 in GHL (5 min)

**Automation → Workflows → Create**

| Step | Setting |
|------|---------|
| Trigger | Contact → **Tag Added** → `tmmt-portal-alert` |
| Action 1 | **Wait** 1 minute |
| Action 2 | **Send SMS** (OpenPhone line) — copy below |
| Action 3 | **Send Email** — subject/body below |
| Action 4 | **Remove Tag** → `tmmt-portal-alert` |

**SMS:**

```
Hi {{contact.first_name}},

TMMT update — check the portal before calling.

Ref: {{contact.tmmt_case_ref}}
Track: {{contact.tmmt_track_url}}
Portal: {{contact.tmmt_portal_url}}

Reply only if urgent.
— TMMT
```

**Email subject:** `TMMT update — {{contact.tmmt_case_ref}}`

**Email body (HTML):**

```html
<p>Hi {{contact.first_name}},</p>
<p>We posted an update. Please check the portal before calling.</p>
<p><a href="{{contact.tmmt_track_url}}">Track status</a> · <a href="{{contact.tmmt_portal_url}}">Client portal</a></p>
<p>Ref: {{contact.tmmt_case_ref}}</p>
```

More workflows: see [GHL_WORKFLOWS.md](./GHL_WORKFLOWS.md).

---

## 5. Test (3 min)

1. In TMMT OS: open an internal case tied to a GHL contact (or use demo client).
2. **Advance status** or **Post update to client**.
3. In GHL: open that contact → confirm custom fields are filled.
4. Confirm workflow ran (SMS/email) and `tmmt-portal-alert` was removed.

**If fields stay empty:** `GHL_API_KEY` / `GHL_LOCATION_ID` missing on Vercel, wrong scopes, or field keys don’t match.

**If workflow doesn’t fire:** tag not added (no GHL contact id on case), or workflow not published.

---

## OpenPhone + Google

- **OpenPhone:** GHL → Settings → Phone → connect OpenPhone; use that number in the SMS action.
- **Google:** same email on GHL contact as portal login + `/track` lookup.
- **No Resend** needed if email sends from GHL.

---

## Team script

> “You’ll get a text when something changes. Use your track link or sign in to the portal first — call only if it’s urgent.”
