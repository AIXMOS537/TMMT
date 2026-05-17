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

Optional (not wired in app yet): `CLICKUP_*`, `AIRTABLE_*`, `GHL_API_KEY`.

Optional host override: `NEXT_PUBLIC_APP_HOST=tmmt-c919-two.vercel.app` (defaults in `next.config.mjs`).

---

## 2. Supabase Auth URL configuration

Supabase Dashboard → Authentication → URL configuration:

| Field | Value |
|-------|--------|
| Site URL | `https://tmmt-c919-two.vercel.app` |
| Redirect URLs | `https://tmmt-c919-two.vercel.app/**` |
| Preview deploys | `https://*.vercel.app/**` |

---

## 3. Redeploy

Vercel → Deployments → Redeploy latest (or push to connected git branch).

`next.config.mjs` `serverActions.allowedOrigins` must include your production host (fixed in repo).

---

## 4. First admin

1. Sign up at `/login`
2. Supabase SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'YOUR_EMAIL';
```

---

## 5. Smoke test

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

## 6. Wire external automations

Point GHL/Airtable/n8n to:

`POST https://tmmt-c919-two.vercel.app/api/intake`  
Header: `X-Intake-Secret: <INTAKE_WEBHOOK_SECRET>`

Collections stay in GHL until workflows in `TMMT MANAGEMENT/AUTOMATIONS/GHL_OVERDUE_WORKFLOW_SETUP.md` are live.
