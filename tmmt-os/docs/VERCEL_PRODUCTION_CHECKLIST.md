# Vercel production checklist — TMMT OS

**Production URL:** https://tmmt-c919-two.vercel.app

Complete these in order after every env change: **save env → redeploy**.

---

## 1. Vercel environment variables

Project → Settings → Environment Variables → set for **Production** and **Preview**:

| Variable | Required |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (never `NEXT_PUBLIC_`) |
| `INTAKE_WEBHOOK_SECRET` | Strongly recommended |
| `GHL_WEBHOOK_SECRET` | If using CRM sync webhooks |
| `GHL_OVERDUE_WEBHOOK_SECRET` | If using overdue n8n → GHL flow |
| `SYNC_WEBHOOK_SECRET` | If using Airtable sync webhook |
| `N8N_WEBHOOK_SECRET` | If using `/api/webhooks/n8n` |
| `AGENT_WEBHOOK_SECRET` | If using `/api/agents/evaluate` |

Optional outbound: `CLICKUP_*`, `AIRTABLE_*`, `GHL_API_KEY`, `GHL_PIPELINE_STAGE_MAP_JSON`.

Optional host override: `NEXT_PUBLIC_APP_HOST=tmmt-c919-two.vercel.app` (defaults in `next.config.mjs`).

---

## 2. Supabase Auth email (magic links)

If login shows **"Error sending magic link email"**, check **Authentication → SMTP Settings**:

- Custom SMTP host must be a real mail server hostname (e.g. `smtp.resend.com`), not a bare domain with no DNS.
- Supabase Auth logs often show: `lookup tmmtrentals.net: no such host` when the SMTP host is wrong.
- **Quick fix for dev:** turn off custom SMTP and use Supabase’s built-in mail (rate-limited).
- **Production:** use Resend, SendGrid, Postmark, or Google Workspace SMTP with verified sender + SPF/DKIM.

Until SMTP works, use **Password** on `/login` (see `scripts/set-test-passwords.mjs` for dev accounts).

---

## 3. Supabase Auth URL configuration

Supabase Dashboard → Authentication → URL configuration:

| Field | Value |
|-------|--------|
| Site URL | `https://tmmt-c919-two.vercel.app` |
| Redirect URLs | `https://tmmt-c919-two.vercel.app/**` |
| Preview deploys | `https://*.vercel.app/**` |

---

## 4. Redeploy

Vercel → Deployments → Redeploy latest (or push to connected git branch).

`next.config.mjs` `serverActions.allowedOrigins` must include your production host (fixed in repo).

---

## 5. First admin

1. Sign up at `/login`
2. Supabase SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'YOUR_EMAIL';
```

---

## 6. Smoke test

| Route | Expect |
|-------|--------|
| `/` | Landing loads |
| `/login` | Auth form |
| `/intake` | Public form |
| `/internal/dashboard` | After login + admin role |
| `/auth/callback` | Magic link completes |

Intake webhook:

```bash
curl -sS -X POST "https://tmmt-c919-two.vercel.app/api/intake" \
  -H "Content-Type: application/json" \
  -H "X-Intake-Secret: YOUR_SECRET" \
  -d '{"customer_name":"Test","request_type":"other","subject":"smoke test","source":"manual"}'
```

---

## 7. Wire external automations

Point GHL/Airtable/n8n to:

`POST https://tmmt-c919-two.vercel.app/api/intake`  
Header: `X-Intake-Secret: <INTAKE_WEBHOOK_SECRET>`

Collections stay in GHL until workflows in `TMMT MANAGEMENT/AUTOMATIONS/GHL_OVERDUE_WORKFLOW_SETUP.md` are live.
