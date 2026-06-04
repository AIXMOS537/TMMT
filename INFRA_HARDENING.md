# TMMT Infra Hardening — Sentry + Cloudflare + Edge

Goal: 100-user-ready observability and abuse defense at zero or near-zero cost.

Last updated: 2026-06-03.

---

## 1. Sentry (errors + perf monitoring) — FREE TIER

**Why:** find out about prod errors from the dashboard, not from angry customers in Slack.

### Account setup (5 min, owner-side)

1. Go to https://sentry.io/signup/ → use `tmmtautodetail@gmail.com`.
2. Org name: `tmmt`. Plan: **Developer (Free)** — 5k errors/mo, 10k perf events/mo, 1 user. Enough for 100-user load.
3. Create project: platform `Next.js`, project name `tmmt-os`.
4. Copy the DSN (looks like `https://abc123@oXXX.ingest.sentry.io/YYY`).

### Code wiring (15 min)

In `~/Projects/TMMT`:

```bash
cd ~/Projects/TMMT
npm install --save @sentry/nextjs
npx @sentry/wizard@latest -i nextjs --saas --org tmmt --project tmmt-os
```

The wizard creates `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, and modifies `next.config.js`. Commit all of these.

### Vercel env vars to add

```
NEXT_PUBLIC_SENTRY_DSN=<paste DSN>
SENTRY_AUTH_TOKEN=<from sentry.io/settings/auth-tokens — scope: project:releases>
SENTRY_ORG=tmmt
SENTRY_PROJECT=tmmt-os
```

Set on **Production + Preview + Development** for the first two; org/project can be in `.sentryclirc` instead.

### Tuning to stay under free-tier limits

In `sentry.client.config.ts`:

```ts
tracesSampleRate: 0.1,        // 10% perf sampling. At 100 users this is < 1k events/mo.
replaysSessionSampleRate: 0,  // off until needed — Replay eats your quota.
replaysOnErrorSampleRate: 1.0, // only record on error
ignoreErrors: [
  'ResizeObserver loop limit exceeded', // browser noise
  'Non-Error promise rejection captured',
],
```

### Alert routes

- High-volume errors (>50 in 1h) → Slack `#tech`
- New issue (first occurrence) → email founder

Configure in Sentry → Alerts → Create Alert → Issue Alert.

### Verification

After deploy:
1. Visit a known-broken route → confirm error appears in Sentry within 60s.
2. Trigger a manual `Sentry.captureMessage('smoke test')` → confirm.

---

## 2. Cloudflare (DNS + CDN + DDoS + Turnstile) — FREE TIER

**Why:** Vercel charges per GB of bandwidth and per function invocation. Cloudflare in front caches static assets, blocks bot traffic, and is free.

### Account + zone setup (10 min, owner-side)

1. https://dash.cloudflare.com/sign-up — use `tmmtautodetail@gmail.com`.
2. Add the customer-facing domain(s) — the .com (rental funnel) and the .net (compliance), per [[project_aixmos_tmmt_funnel]].
3. Cloudflare gives you 2 nameservers — update them at your registrar (Namecheap/GoDaddy/wherever the domains live).
4. Wait for "active" status — typically 5–30 min.

### DNS records (move from current host)

For each domain:

| Type | Name | Target | Proxy |
|---|---|---|---|
| `CNAME` | `@` (apex) | `cname.vercel-dns.com` | **Proxied (orange cloud)** |
| `CNAME` | `www` | `cname.vercel-dns.com` | Proxied |
| `MX`/`TXT` | (mail records) | unchanged | DNS only (grey cloud) |
| `TXT` | `_vercel` | `vc-domain-verify=...` | DNS only |

**Critical:** keep MX/TXT/DKIM as DNS-only (grey cloud) so email keeps working. Only proxy A/AAAA/CNAME records for the web app.

### Vercel side

In each Vercel project → Settings → Domains:
1. Add the domain.
2. Vercel will give you a verification `TXT` — add to Cloudflare DNS (grey cloud).
3. Once verified, leave the apex CNAME in CF proxied — Vercel + CF orange cloud is supported on Pro CF and on Free for non-apex; if you hit issues on apex, switch apex to `A 76.76.21.21` (Vercel's anycast IP).

### Free-tier security settings

Cloudflare Dashboard → your domain →

- **SSL/TLS → Overview** → mode `Full (strict)` — Vercel terminates TLS, CF re-encrypts.
- **SSL/TLS → Edge Certificates** → "Always Use HTTPS" ON; "Automatic HTTPS Rewrites" ON; min TLS version 1.2.
- **Security → WAF → Managed rules** → enable Free tier managed ruleset (Cloudflare Managed Ruleset basic). Free tier includes ~25 OWASP rules.
- **Security → Bots** → "Bot Fight Mode" ON (free).
- **Security → Settings** → Security Level: `Medium`. Challenge Passage: 30 min.
- **Caching → Configuration** → Caching Level `Standard`, Browser Cache TTL `4 hours`. Add page rule: cache `*/static/*` and `*.js`, `*.css`, `*.woff2` aggressively (Edge Cache TTL `1 month`).
- **Rules → Page Rules** (free tier: 3 rules) — use them for: (1) always-HTTPS apex, (2) bypass cache for `/api/*`, (3) cache-everything for `/assets/*`.

### Rate limiting on /api/* (free tier: 10k requests/mo on rate limiting rules)

Security → WAF → Rate limiting rules → Create:
- **Name:** `api-burst`
- **Match:** URI Path contains `/api/`
- **Rate:** 30 requests per 1 minute per IP
- **Action:** Block for 10 min

Tune up if real customers get hit; tune down if abuse appears.

### Turnstile (captcha replacement) — FREE, unlimited

1. CF Dashboard → Turnstile → Add site → Domain: your domain. Mode: `Managed` (invisible most of the time).
2. Copy site key + secret key.
3. Add to Vercel envs:
   ```
   NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site key>
   TURNSTILE_SECRET_KEY=<secret key>
   ```
4. Place the widget on lead-capture forms (incoming_leads, waitlist, intake) before they POST to Supabase. Verify server-side in the edge function (next section).

---

## 3. Supabase abuse gate — edge function for anon writes

**Why:** today, anyone with the anon key can `INSERT` into `tickets`, `background_checks`, `incoming_leads`, `waitlist`, `appointments`, `customer_intake_forms`. With Turnstile in front, we can verify a human before each write and rate-limit per IP.

### Pattern

Create a Supabase Edge Function `intake` that:
1. Validates the Turnstile token (`POST https://challenges.cloudflare.com/turnstile/v0/siteverify`).
2. Rate-limits per `cf-connecting-ip` header (Supabase KV: 10 writes / 10 min per IP).
3. Forwards the request to the appropriate table using the **service role key** (never expose this client-side).
4. Returns `{ ok: true }` or `{ ok: false, code: ... }`.

Then **revoke anon INSERT** on those tables — they only accept writes via this function.

### SQL after edge function is live

```sql
-- Run in Supabase SQL editor after intake() edge function is deployed and tested.
revoke insert on public.tickets from anon;
revoke insert on public.background_checks from anon;
revoke insert on public.incoming_leads from anon;
revoke insert on public.waitlist from anon;
revoke insert on public.appointments from anon;
revoke insert on public.customer_intake_forms from anon;
revoke insert on public.vehicle_handover from anon;
revoke insert on public.customer_inspection_photos from anon;
revoke insert on public.vehicle_onboarding_inspections from anon;
```

DO NOT run this until the edge function is in place — it will break every public form.

---

## 4. Critical RLS fix (do FIRST, today)

`program_applications` currently allows **anon UPDATE without restriction** (policy `program_applications_anon_update`). Today the table is empty (0 rows) so impact is minimal, but the moment any row exists, anyone on the internet can rewrite it.

```sql
-- Inspect first to confirm name:
select polname, polcmd
from pg_policy
where polrelid = 'public.program_applications'::regclass;

-- Then drop the offending policy:
drop policy if exists program_applications_anon_update on public.program_applications;

-- (Re-add a scoped UPDATE if anon update is actually needed — but only against own row.)
```

## 5. SECURITY DEFINER function lockdown

26 functions are marked SECURITY DEFINER and executable by anon/authenticated. Lock them down:

```sql
-- For each business-logic mutator, revoke broad EXECUTE:
revoke execute on function public.assign_unit(uuid, uuid) from anon, authenticated;
revoke execute on function public.lock_expired_assignments() from anon, authenticated;
revoke execute on function public.recompute_journey(uuid) from anon, authenticated;
revoke execute on function public.compute_good_standing(uuid) from anon, authenticated;
revoke execute on function public.compute_lto_eligible(uuid) from anon, authenticated;
revoke execute on function public.submit_customer_intake(jsonb) from anon, authenticated;

-- For predicate helpers (is_admin, is_super_admin, is_staff, is_internal_ops, is_manager, current_role),
-- audit each — they may need to remain callable for RLS to work, but they should not be reachable
-- via PostgREST RPC. Make them SECURITY INVOKER if possible, or restrict execute:
revoke execute on function public.is_admin() from anon;
revoke execute on function public.is_super_admin() from anon;
-- etc.
```

Run the `pg_proc` query first to get the exact signatures — function signatures change.

## 6. HaveIBeenPwned — Supabase dashboard toggle

**60 seconds:**
Supabase Dashboard → Authentication → Policies → "Enable password breach detection" → ON.

Blocks signups using passwords found in known breaches.

---

## Order of operations (recommended)

1. **Today (15 min, owner):** Sentry signup + DSN ready. HaveIBeenPwned toggle on.
2. **Today (10 min, founder + me):** Run the `program_applications` RLS drop. Validate.
3. **Day 1 (1 hour):** Install Sentry SDK in TMMT repo, deploy, verify errors appear.
4. **Day 1-2 (2 hours, owner):** Cloudflare zone setup + nameserver swap + basic settings.
5. **Day 2-3 (1 day):** Build the Supabase `intake` edge function with Turnstile verify + rate limit. Test against staging.
6. **Day 3 (30 min):** Revoke anon INSERTs after edge function is verified.
7. **Day 3-4 (1 hour):** Lock SECURITY DEFINER functions.
8. **Day 4 (30 min):** Cloudflare rate-limit rule + Bot Fight Mode + WAF managed rules ON.

Total: ~2 working days of focus, fully under free tiers.

## What this costs

| Service | Tier | Cost | Headroom at 100 users |
|---|---|---|---|
| Sentry | Developer (free) | $0 | 5k errors/mo (you'd be ~200) |
| Cloudflare | Free | $0 | unlimited requests |
| Cloudflare Turnstile | Free | $0 | unlimited |
| Supabase | Pro? Check | $25/mo if Pro | 100 users is fine on Free for a while |
| Vercel | Hobby/Pro | $0–20/mo | with CF caching, function invocations stay low |

Total infra net new at 100 users: **~$0–25/mo**.
