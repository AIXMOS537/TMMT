# Domain setup — All In One Management Solutions

> **`.com`** = public AIXMOS (clients, operators applying, marketing)  
> **`.net`** = your private owner access hub (command desk, full admin, ops)

---

## Architecture

| URL | Host | Who | What |
|-----|------|-----|------|
| `allinonemanagementsolutions.com` | Vercel (static) | Public | AIXMOS landing, apply, operator intake, thank-you |
| `www.allinonemanagementsolutions.com` | Redirect → apex | Public | Optional |
| `allinonemanagementsolutions.net` | Vercel (TMMT app) | **You (admin only)** | Command center, TMMT admin, executive tools |
| `network.allinonemanagementsolutions.com` | Vercel (later) | Operators / staff | Operator feed, assigned verticals (Phase 2) |
| `portal.allinonemanagementsolutions.com` | UGREEN NAS (later) | Role-based | Training vault, large files via signed URLs |

**Brand mapping**

- **All In One Management Solutions** — parent company domain
- **AIXMOS** — product name on the public `.com` site
- **`.net`** — not marketed publicly; bookmark it for your command desk

---

## GoDaddy DNS

### `allinonemanagementsolutions.com`

| Type | Name | Value | Notes |
|------|------|-------|-------|
| A | `@` | `76.76.21.21` | Vercel apex (confirm in Vercel dashboard) |
| CNAME | `www` | `cname.vercel-dns.com` | |
| CNAME | `network` | `cname.vercel-dns.com` | Phase 2 — operator/staff hub |

**Vercel project:** import repo, set **Root Directory** to `AIXMOS/public`, attach this domain.

Remove GoDaddy **parking** records and conflicting A records.

### `allinonemanagementsolutions.net`

| Type | Name | Value | Notes |
|------|------|-------|-------|
| A | `@` | `76.76.21.21` | Vercel apex — TMMT Next.js app |
| CNAME | `www` | `cname.vercel-dns.com` | Optional; redirect www → apex in Vercel |

**Vercel project:** TMMT app (repo root), attach **only** `.net` domains here.

Do **not** forward `.net` to `.com`. They serve different purposes.

---

## Vercel — two projects

### Project 1: `aixmos-landing` (public `.com`)

```
Repository:  Metavibez4L/TMMT
Root:        AIXMOS/public
Framework:   Other (static)
Domains:     allinonemanagementsolutions.com
             www.allinonemanagementsolutions.com
```

### Project 2: `tmmt-owner-hub` (private `.net`)

```
Repository:  Metavibez4L/TMMT
Root:        /  (repo root)
Framework:   Next.js
Domains:     allinonemanagementsolutions.net
             www.allinonemanagementsolutions.net
```

Env vars for Project 2:

```env
NEXT_PUBLIC_PUBLIC_SITE_HOST=allinonemanagementsolutions.com
NEXT_PUBLIC_OWNER_HUB_HOST=allinonemanagementsolutions.net
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## Owner hub behavior (`.net`)

Middleware enforces:

1. Only users with `app_metadata.role = admin` may use `.net` (after login).
2. Root `/` redirects to `/command` for you.
3. Everyone else is sent to `https://allinonemanagementsolutions.com/login`.
4. Public customer forms stay on `.com` only (`/forms/*` on `.net redirects to `.com`).

Your Supabase user must have:

```json
{ "role": "admin" }
```

in **Authentication → Users → app_metadata**.

---

## Launch checklist

### You (GoDaddy + Vercel) — ~20 minutes

- [ ] Create Vercel project for `AIXMOS/public` → add `.com` domain
- [ ] Add `.net` domain to existing TMMT Vercel project
- [ ] Paste DNS records in GoDaddy for both domains
- [ ] Wait for Vercel “Valid Configuration” on both
- [ ] Confirm your Supabase login has `admin` role
- [ ] Visit `https://allinonemanagementsolutions.net` → login → lands on `/command`

### Cursor / Claude — code (already in repo)

- [x] Owner hub middleware (`middleware.ts` + `src/lib/site-domains.ts`)
- [ ] Replace GHL placeholders in `AIXMOS/public/ghl-config.js`
- [ ] Phase 2: `network.allinonemanagementsolutions.com` for operators

---

## GHL wiring (after domains live)

| GHL asset | URL |
|-----------|-----|
| Operator apply link | `https://allinonemanagementsolutions.com/operator.html` |
| Client intake | `https://allinonemanagementsolutions.com/apply.html` |
| Post-submit thank you | `https://allinonemanagementsolutions.com/thankyou.html` |
| Your command desk (private) | `https://allinonemanagementsolutions.net` |

GHL Client Portal custom menu for **paying clients** → `.com` pages or future `network.` subdomain — not `.net`.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Domain shows GoDaddy parking | Delete parking A record; add Vercel A/CNAME |
| Vercel “Invalid Configuration” | Double-check A = `76.76.21.21`; wait up to 1 hour |
| `.net` loads but redirects to `.com` | Your Supabase user needs `admin` in app_metadata |
| `.com` 404 | Deploy `AIXMOS/public` project; confirm root directory |
| SSL errors | Let Vercel provision certs after DNS validates |

Verify DNS globally: [dnschecker.org](https://dnschecker.org)
