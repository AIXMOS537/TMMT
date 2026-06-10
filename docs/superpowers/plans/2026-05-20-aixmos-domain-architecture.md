# AIXMOS Domain Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Special note for this plan:** Most steps are manual actions in external dashboards (GoDaddy, Vercel, GHL, Microsoft 365, Google Admin). The agentic executor's role is to **prompt the user at each step, verify outcomes via CLI commands (`dig`, `curl`), and update local files**. The user performs dashboard clicks; the agent performs verification and documentation.

**Goal:** Execute the migration described in `docs/superpowers/specs/2026-05-20-aixmos-domain-architecture-design.md` — moving all `.com` traffic from Vercel to GHL, attaching `.net` to Vercel with subdomain routing, aliasing `.net` domains into the existing email tenants, and capturing the final state in an inventory document.

**Architecture:** 9 sequential phases. Phase 0 verifies the starting state. Phases 1–7 execute the migration in the spec's sequence (GHL build → Vercel detach → DNS cut-over → `.net` setup → email → hardening). Phase 8 documents the final state. The migration is reversible at every step up through Phase 3 via DNS TTL (set to 600s during cut-over).

**Tech Stack:** GoDaddy (DNS), Vercel (`.net` hosting), GoHighLevel (`.com` hosting), Microsoft 365 (AIOMS email), Google Workspace (TMMT email), `dig`/`curl` (verification).

---

## Prerequisite Plans

This plan **cannot execute Phase 3 or later** until the following companion plan is complete:

- **TMMT codebase refactor plan** (to be written) — removes `.com` host detection from `middleware.ts`, changes unauthenticated redirect target from `aioms.com/login` to the `.net` app's own `/login`, adds `X-Robots-Tag: noindex, nofollow` middleware header, deletes `AIXMOS/public/` static assets.

Phases 0–2 can proceed without the refactor. Phase 3 (DNS cut-over) **must wait** until the refactor is deployed to `tmmt-c919` production.

---

## File Structure

This plan creates / modifies the following local files. All other work happens in external dashboards.

**Create:**
- `docs/INFRASTRUCTURE-INVENTORY.md` — single source of truth for all infra state

**Modify:**
- `docs/DOMAIN-SETUP.md` — deprecate (replace with pointer to spec + inventory)

**No code changes in this plan.** All code work is in the prerequisite refactor plan.

---

## Phase 0: Pre-flight verification

Confirm the current state matches the spec's assumptions before changing anything.

### Task 0.1: Verify Vercel current state on `tmmt-c919`

**Files:** None.

- [ ] **Step 1: Confirm domains attached to `tmmt-c919`**

User action: Log into Vercel → project `tmmt-c919` → Settings → Domains.

Expected: `allinonemanagementsolutions.com` and `allinonemanagementsolutions.net` are listed. `tmmtrentals.*` are NOT listed.

Record the exact list of currently-attached domains in a scratch note (will be referenced in Task 8.1).

- [ ] **Step 2: Confirm production branch and last deploy**

User action: In Vercel → Deployments, confirm the latest production deployment is healthy (status: Ready) and identify the production branch.

Expected: Latest deployment Ready. Production branch name recorded.

### Task 0.2: Verify current GoDaddy DNS for all 4 domains

**Files:** None.

- [ ] **Step 1: Pull DNS for all 4 domains via `dig`**

Run:
```bash
for d in allinonemanagementsolutions.com allinonemanagementsolutions.net tmmtrentals.com tmmtrentals.net; do
  echo "=== $d ==="
  dig +short $d
  dig +short www.$d
  dig +short MX $d
done
```

Expected: `aioms.com` and `.net` resolve to Vercel IP `76.76.21.21` (or similar). `tmmtrentals.com` may resolve to GoDaddy parking. `tmmtrentals.net` likely returns nothing.

Save output to scratch — needed for rollback decisions later.

- [ ] **Step 2: List records in GoDaddy DNS console per domain**

User action: GoDaddy → My Products → DNS for each of the 4 domains. Screenshot or note the current records.

Expected output recorded for each domain. Special attention to GoDaddy "Forwarding" rules — note any that exist (they must be removed in later phases).

### Task 0.3: Verify email tenant access

**Files:** None.

- [ ] **Step 1: Confirm Microsoft 365 admin access**

User action: Log into [admin.microsoft.com](https://admin.microsoft.com). Verify access to the tenant that hosts `allinonemanagementsolutions.com`. Navigate to Settings → Domains. Confirm `allinonemanagementsolutions.com` is listed as Verified.

Expected: Domain status = Verified. Recorded.

- [ ] **Step 2: Confirm Google Workspace admin access**

User action: Log into [admin.google.com](https://admin.google.com). Verify access to the workspace that hosts `tmmtrentals.com`. Navigate to Domains → Manage domains. Confirm `tmmtrentals.com` is listed.

Expected: Domain listed. Recorded.

### Task 0.4: Verify GHL access and create sub-accounts (if needed)

**Files:** None.

- [ ] **Step 1: Confirm GHL agency or sub-account access**

User action: Log into GHL. Confirm an agency-level account exists OR sub-accounts exist for AIOMS and TMMT.

Expected: Access confirmed. Sub-account structure noted.

- [ ] **Step 2: Decision — single GHL agency with 2 sub-accounts, or separate GHL instances?**

This is **Open Question #3** from the spec. Make the call now before Phase 1.

Recommendation: single agency account with two sub-accounts (one per brand). Lower billing overhead, single admin login. Only choose separate GHL instances if there's a regulatory/billing reason.

Record decision in scratch. Will be captured in INFRASTRUCTURE-INVENTORY.md (Task 8.1).

---

## Phase 1: GHL site readiness

Build the public marketing sites **before** changing any DNS. GHL provides preview URLs (e.g., `aioms.preview.gohighlevel.com`) for testing while the real domain still points elsewhere.

This phase is owned by the marketing/content workstream — **the plan does not specify funnel content**, only that the sites must exist before DNS cut-over.

### Task 1.1: GHL site for `allinonemanagementsolutions.com`

**Files:** None.

- [ ] **Step 1: Create / verify the AIOMS GHL site**

User action: In GHL → Sites → create the AIOMS marketing site (or confirm one exists). Add pages: landing, about, operator-apply, applicant-apply, thank-you. Source content from existing `AIXMOS/public/` HTML files in the TMMT repo.

Expected: Site exists with all pages, viewable via GHL preview URL.

- [ ] **Step 2: Smoke-test the GHL preview URL**

User action: Open the preview URL in an incognito window. Verify all pages load, all forms submit without error, all internal links work.

Expected: All pages render. No 404s on internal navigation. Form submissions reach GHL pipeline.

- [ ] **Step 3: Label the GHL site `[PUBLIC] AIXMOS parent-co — aioms.com`**

User action: In GHL site settings, update the site name / description to include the tag.

### Task 1.2: GHL site for `tmmtrentals.com`

**Files:** None.

- [ ] **Step 1: Create / verify the TMMT GHL site**

User action: In GHL → Sites → create the TMMT marketing site (separate from AIOMS). Pages: landing, fleet, book, contact.

Expected: Site exists, viewable via GHL preview URL.

- [ ] **Step 2: Smoke-test the GHL preview URL**

User action: Same smoke test as Task 1.1 Step 2.

- [ ] **Step 3: Label the GHL site `[PUBLIC] TMMT Rentals — tmmtrentals.com`**

User action: Update site name / description in GHL settings.

### Task 1.3: PREREQUISITE GATE — code refactor must be deployed

**Files:** None.

- [ ] **Step 1: Confirm refactor plan has executed**

Before proceeding to Phase 2, the code refactor plan **must** be complete and deployed to `tmmt-c919` production. Specifically:
- `middleware.ts` no longer redirects to `publicSiteOrigin()` for login (uses local `/login` instead)
- `middleware.ts` adds `X-Robots-Tag: noindex, nofollow` on all responses
- `AIXMOS/public/` static assets are removed

Run on the deployed site (note: `allinonemanagementsolutions.net` is still attached to `tmmt-c919` at this point — detached in Task 2.2):
```bash
curl -sI https://allinonemanagementsolutions.net 2>&1 | grep -i 'x-robots-tag'
```

Expected: header present with `noindex, nofollow`. If absent, **stop** — execute the refactor plan first.

- [ ] **Step 2: Confirm `AIXMOS/public/` removal**

Run in the repo:
```bash
test -d /Users/ceo.moe/TMMT/AIXMOS/public && echo "STILL PRESENT — refactor incomplete" || echo "REMOVED — OK"
```

Expected: `REMOVED — OK`. If still present, the refactor plan didn't ship completely.

- [ ] **Step 3: Confirm login redirect goes to local `/login`, not cross-domain**

User action: Open `https://allinonemanagementsolutions.net/command` in an incognito window.

Expected: redirect to `https://allinonemanagementsolutions.net/login` (same origin). **If it redirects to `https://allinonemanagementsolutions.com/login`, the refactor is incomplete — stop.**

This is the most important check — if the cross-domain login redirect still exists, Phase 3 will break unauthenticated access to `.net`.

---

## Phase 2: Detach `.com` from Vercel `tmmt-c919`

Remove the domain attachment in Vercel **before** changing DNS at GoDaddy. This ordering matters: if DNS changes first, the GHL site goes live while Vercel still thinks it owns the domain, which can cause cert conflicts.

### Task 2.1: Remove `allinonemanagementsolutions.com` from Vercel

**Files:** None.

- [ ] **Step 1: Detach the apex domain**

User action: Vercel → `tmmt-c919` → Settings → Domains → click `allinonemanagementsolutions.com` → Remove.

Expected: Domain disappears from the project's domain list. Vercel may warn about active traffic — proceed (the GHL site is ready per Phase 1).

- [ ] **Step 2: Detach `www.allinonemanagementsolutions.com` if present**

User action: Same flow for the www subdomain if it was attached.

Expected: www subdomain detached.

- [ ] **Step 3: Verify detachment**

Run:
```bash
curl -sI https://allinonemanagementsolutions.com 2>&1 | head -5
```

Expected: HTTPS still works (DNS still points to old Vercel IP — that's fine, the cert at the edge stays valid until we change DNS in Phase 3). The response body will be Vercel's "domain not found in project" page or the old AIXMOS static page from a cached deployment. **This is the brief window where DNS still routes to Vercel but Vercel no longer claims the domain.**

Window length: minutes (the next phase changes DNS). Keep it short.

### Task 2.2: Take `allinonemanagementsolutions.net` dormant

Per the spec, `aioms.net` becomes dormant (no Vercel attachment, no DNS records at GoDaddy) until the future credit-repair / AIXMOS command-center app exists. Currently it's attached to `tmmt-c919` and has live DNS — both must come down.

**Notify any staff who use `https://allinonemanagementsolutions.net` for the rental admin BEFORE doing this** — they'll need to use `https://tmmtrentals.net` once Phase 5 completes. Window of unavailability: hours-to-days (between this task and Phase 5 Task 5.3 verification).

**Files:** None.

- [ ] **Step 1: Notify staff of bookmark change**

User action: Send an internal note to any staff using `aioms.net` for rental admin: "We're migrating the rental admin to `tmmtrentals.net`. Today, `aioms.net` will be taken offline. Use `tmmtrentals.net` once it comes online tomorrow / by [date]." Get acknowledgment from each staff member before proceeding.

Expected: All staff acknowledged.

- [ ] **Step 2: Detach `allinonemanagementsolutions.net` and www from Vercel**

User action: Vercel → `tmmt-c919` → Settings → Domains → remove `allinonemanagementsolutions.net` and `www.allinonemanagementsolutions.net` (if attached).

Expected: Both removed from Vercel domain list.

- [ ] **Step 3: Delete ALL DNS records for `allinonemanagementsolutions.net` at GoDaddy**

User action: GoDaddy DNS for `allinonemanagementsolutions.net` → delete every record except those required by GoDaddy itself (NS records and the GoDaddy-managed SOA — these can't be deleted). Specifically delete:
- `@` A record pointing to `76.76.21.21`
- `www` CNAME pointing to `cname.vercel-dns.com`
- Any other A/CNAME/TXT records that aren't M365 email-related

**Do not delete email records.** If the domain currently has MX/SPF/DKIM/DMARC records for M365, keep them — Phase 6 builds on them.

Wait — actually, per Task 0.2, this domain likely does NOT yet have M365 records (the email lives on `aioms.com`, not `.net`). If you confirm no email records exist for `.net`, you can delete everything except NS/SOA. Phase 6 will create email records fresh.

- [ ] **Step 4: Verify the domain is unreachable**

Run:
```bash
dig allinonemanagementsolutions.net @8.8.8.8
curl -sI https://allinonemanagementsolutions.net 2>&1 | head -3
```

Expected: `dig` returns no A record (or NS-only). `curl` fails with connection error or shows old cached behavior briefly until TTL expires.

Within ~10 minutes (TTL countdown), the domain is fully dormant — no longer reachable on the web.

---

## Phase 3: DNS cut-over for `allinonemanagementsolutions.com` → GHL

**Hard prerequisite verified in Task 1.3.** Do not start this phase if the refactor isn't deployed.

### Task 3.1: Get GHL DNS values for AIOMS

**Files:** None.

- [ ] **Step 1: In GHL → Sites → `[PUBLIC] AIXMOS parent-co` → Settings → Domains, click "Add Custom Domain" and enter `allinonemanagementsolutions.com`**

User action: GHL will display the exact A record value and CNAME value to use. Copy both.

Expected: GHL shows something like `A @ → <IP>` and `CNAME www → <ghl-hostname>`. Record both values.

### Task 3.2: Set GoDaddy TTL to 600s on AIOMS records (rollback safety)

**Files:** None.

- [ ] **Step 1: Open GoDaddy DNS for `allinonemanagementsolutions.com`**

User action: GoDaddy → DNS for the domain. Locate the current A and CNAME records (from Task 0.2 Step 2).

- [ ] **Step 2: Change TTL to 600s on existing records before editing values**

User action: For the existing apex A record and www CNAME, set TTL to 600 seconds (10 min). Save.

Expected: Records still have OLD values but new TTL. Wait 10 minutes (or whatever the previous TTL was) before proceeding — this ensures the next change propagates quickly.

### Task 3.3: Cut DNS over to GHL

**Files:** None.

- [ ] **Step 1: Delete GoDaddy default records that conflict**

User action: In GoDaddy DNS for `allinonemanagementsolutions.com`, delete:
- Old `@` A record (Vercel `76.76.21.21`)
- Old `www` CNAME (Vercel)
- Any GoDaddy "Forwarding" rule
- Any default parking records

- [ ] **Step 2: Add new GHL apex A record**

User action: Add new record:
- Type: A
- Name: `@`
- Value: *(GHL value from Task 3.1)*
- TTL: 600
- **Notes field:** `[PUBLIC] AIOMS marketing — GHL apex`

- [ ] **Step 3: Add new GHL www CNAME**

User action: Add new record:
- Type: CNAME
- Name: `www`
- Value: *(GHL value from Task 3.1)*
- TTL: 600
- **Notes field:** `[PUBLIC] www redirect via GHL`

- [ ] **Step 4: In GHL, configure www → apex redirect**

User action: In GHL Sites → AIOMS site → Domain settings → enable "Redirect www to apex".

Expected: GHL acknowledges the redirect rule.

### Task 3.4: Verify cut-over

**Files:** None.

- [ ] **Step 1: Wait for DNS propagation (5–15 min)**

Run repeatedly:
```bash
dig +short allinonemanagementsolutions.com @8.8.8.8
dig +short www.allinonemanagementsolutions.com @8.8.8.8
```

Expected: returns the new GHL values. If still returning `76.76.21.21`, wait longer (TTL countdown).

- [ ] **Step 2: Verify SSL certificate issuance**

Run:
```bash
curl -sI https://allinonemanagementsolutions.com 2>&1 | head -5
echo "---"
curl -sI https://www.allinonemanagementsolutions.com 2>&1 | head -5
```

Expected: HTTP 200 (or 301 redirect for www). No SSL errors. The `Server:` header should indicate GHL/Cloudflare/Google Cloud (depending on what GHL uses).

GHL provisions Let's Encrypt certs automatically. Allow up to ~30 min from DNS change.

- [ ] **Step 3: Verify www → apex redirect**

Run:
```bash
curl -sI https://www.allinonemanagementsolutions.com 2>&1 | grep -i location
```

Expected: `Location: https://allinonemanagementsolutions.com/` (301 or 302).

- [ ] **Step 4: Smoke-test in browser**

User action: Open `https://allinonemanagementsolutions.com` in incognito. Confirm GHL marketing site renders, not the old AIXMOS static page.

Expected: GHL site visible. If old AIXMOS page still shows, the browser is caching — try a different network or device.

### Task 3.5: Rollback procedure (only if Task 3.4 fails)

**Files:** None.

- [ ] **Step 1: If verification fails, revert DNS at GoDaddy**

User action: In GoDaddy DNS, revert `@` A record to `76.76.21.21` and `www` CNAME to `cname.vercel-dns.com`. Re-attach `allinonemanagementsolutions.com` to Vercel `tmmt-c919` in Vercel dashboard.

Expected: Within 10 min (TTL), traffic returns to Vercel. Investigate GHL setup before retrying Phase 3.

---

## Phase 4: DNS setup for `tmmtrentals.com` → GHL (greenfield)

No prior Vercel attachment to detach. New attachment to GHL.

### Task 4.1: Get GHL DNS values for TMMT

**Files:** None.

- [ ] **Step 1: In GHL → Sites → `[PUBLIC] TMMT Rentals` → Settings → Domains, add `tmmtrentals.com`**

User action: GHL displays A and CNAME values. Copy both.

### Task 4.2: Configure GoDaddy DNS for `tmmtrentals.com`

**Files:** None.

- [ ] **Step 1: Delete GoDaddy default records**

User action: In GoDaddy DNS for `tmmtrentals.com`, delete:
- Default `@` A record (GoDaddy parking)
- Default `www` CNAME
- Any GoDaddy "Forwarding" rule

- [ ] **Step 2: Add new GHL apex A record**

User action: Add:
- Type: A
- Name: `@`
- Value: *(GHL value)*
- TTL: 600
- **Notes:** `[PUBLIC] TMMT marketing — GHL apex`

- [ ] **Step 3: Add new GHL www CNAME**

User action: Add:
- Type: CNAME
- Name: `www`
- Value: *(GHL value)*
- TTL: 600
- **Notes:** `[PUBLIC] www redirect via GHL`

- [ ] **Step 4: In GHL, configure www → apex redirect**

User action: Same as Task 3.3 Step 4 but for the TMMT site.

### Task 4.3: Verify cut-over

**Files:** None.

- [ ] **Step 1: Wait for DNS propagation, then verify**

Run:
```bash
dig +short tmmtrentals.com @8.8.8.8
dig +short www.tmmtrentals.com @8.8.8.8
curl -sI https://tmmtrentals.com 2>&1 | head -3
curl -sI https://www.tmmtrentals.com 2>&1 | grep -i location
```

Expected: returns GHL values; SSL works; www redirects to apex.

- [ ] **Step 2: Smoke-test in browser**

User action: Confirm GHL TMMT site renders at `https://tmmtrentals.com`.

---

## Phase 5: DNS + Vercel for `tmmtrentals.net`

Attach `tmmtrentals.net`, `www.tmmtrentals.net`, and `admin.tmmtrentals.net` to the existing `tmmt-c919` Vercel project. App routes by host header.

### Task 5.1: Add domains to Vercel `tmmt-c919`

**Files:** None.

- [ ] **Step 1: In Vercel `tmmt-c919` → Settings → Domains, click Add**

User action: Add the following domains one at a time:
- `tmmtrentals.net`
- `www.tmmtrentals.net`
- `admin.tmmtrentals.net`

For each, Vercel will display required DNS records. Verify Vercel expects `76.76.21.21` for apex and `cname.vercel-dns.com` for the CNAMEs.

Expected: All three domains added in Vercel, each with status "Invalid Configuration" (because GoDaddy hasn't been pointed yet).

### Task 5.2: Configure GoDaddy DNS for `tmmtrentals.net`

**Files:** None.

- [ ] **Step 1: Delete default GoDaddy records and any forwarding rules**

User action: In GoDaddy DNS for `tmmtrentals.net`, clear defaults.

- [ ] **Step 2: Add apex A record**

User action: Add:
- Type: A
- Name: `@`
- Value: `76.76.21.21`
- TTL: 600
- **Notes:** `[INTERNAL] Vercel apex — staff app`

- [ ] **Step 3: Add www CNAME**

User action: Add:
- Type: CNAME
- Name: `www`
- Value: `cname.vercel-dns.com`
- TTL: 600
- **Notes:** `[INTERNAL] www → apex (configure in Vercel)`

- [ ] **Step 4: Add admin CNAME**

User action: Add:
- Type: CNAME
- Name: `admin`
- Value: `cname.vercel-dns.com`
- TTL: 600
- **Notes:** `[INTERNAL] Routes to tmmt-c919 — same project as @`

- [ ] **Step 5: In Vercel, configure `www.tmmtrentals.net` to redirect to apex**

User action: Vercel → `tmmt-c919` → Domains → `www.tmmtrentals.net` → set to "Redirect to" `tmmtrentals.net`.

### Task 5.3: Verify DNS and SSL

**Files:** None.

- [ ] **Step 1: Wait for DNS propagation, then verify each domain**

Run:
```bash
for sub in '' www. admin.; do
  echo "=== ${sub}tmmtrentals.net ==="
  dig +short ${sub}tmmtrentals.net @8.8.8.8
done
```

Expected: apex returns `76.76.21.21`; www and admin return Vercel CNAME chain.

- [ ] **Step 2: Verify SSL on each domain**

Run:
```bash
curl -sI https://tmmtrentals.net 2>&1 | head -3
curl -sI https://www.tmmtrentals.net 2>&1 | grep -i location
curl -sI https://admin.tmmtrentals.net 2>&1 | head -3
```

Expected: 200 (or login redirect for protected paths) on apex and admin; 301 redirect to apex on www.

- [ ] **Step 3: Verify `X-Robots-Tag` header present (from refactor)**

Run:
```bash
curl -sI https://tmmtrentals.net 2>&1 | grep -i 'x-robots-tag'
```

Expected: `X-Robots-Tag: noindex, nofollow` (or similar). If absent, the refactor plan didn't ship — investigate.

- [ ] **Step 4: Verify auth gate redirects unauthenticated traffic**

User action: Open `https://tmmtrentals.net/` (apex) in incognito.

Expected: redirect to `https://tmmtrentals.net/login` on the same `.net` domain (NOT to `aioms.com/login`). If it redirects to `.com`, the refactor's login-redirect change wasn't applied — return to the refactor plan.

Note: the `admin.` subdomain currently routes to the same Vercel project (`tmmt-c919`) but the app does not yet have host-based subdomain routing — `admin.tmmtrentals.net` will serve the same content as the apex until the refactor adds subdomain handling. That's expected for now; the subdomain DNS attachment is in place for future use.

- [ ] **Step 5: Verify subdomain SSO (if multi-subdomain auth needed)**

User action: Log in at `https://tmmtrentals.net`. Then navigate to `https://admin.tmmtrentals.net` in the same browser session.

Expected: session carries — no re-login required. If re-login is required, Supabase cookie domain isn't set to `.tmmtrentals.net` (leading dot). This is **Open Question #4** from the spec; fix in a small follow-up.

### Task 5.4: Verify `robots.txt` blocks crawlers

**Files:** None.

- [ ] **Step 1: Confirm `robots.txt` denies all**

Run:
```bash
curl -s https://tmmtrentals.net/robots.txt
```

Expected:
```
User-agent: *
Disallow: /
```

If the response is empty, missing, or allows crawling, add this to the refactor plan as a follow-up (the existing app may not have `robots.txt`).

---

## Phase 6: Email `.net` domains (alias into existing tenants)

### Task 6.1: Add `allinonemanagementsolutions.net` to Microsoft 365

**Files:** None.

- [ ] **Step 1: Add the domain in M365 admin**

User action: M365 admin → Settings → Domains → Add domain → `allinonemanagementsolutions.net`. Follow the wizard.

- [ ] **Step 2: Add M365 verification TXT record at GoDaddy**

User action: M365 will show a TXT record value (something like `MS=ms12345678`). Add to GoDaddy:
- Type: TXT
- Name: `@`
- Value: *(from M365)*
- TTL: 600
- **Notes:** `[INTERNAL][EMAIL] M365 domain verification`

- [ ] **Step 3: Click Verify in M365 admin**

User action: Wait 5 min, then click Verify in the M365 wizard.

Expected: Domain status flips to Verified.

- [ ] **Step 4: Add M365 mail records (MX, SPF, DKIM, autodiscover)**

User action: M365 will display the records to add. Paste into GoDaddy with `[INTERNAL][EMAIL]` notes. Records:

| Type | Name | Value | Note |
|---|---|---|---|
| MX | `@` | *(tenant-specific Outlook value)* | `[INTERNAL][EMAIL] M365 MX` |
| TXT | `@` | `v=spf1 include:spf.protection.outlook.com -all` | `[INTERNAL][EMAIL] SPF` |
| CNAME | `selector1._domainkey` | *(from M365)* | `[INTERNAL][EMAIL] DKIM 1` |
| CNAME | `selector2._domainkey` | *(from M365)* | `[INTERNAL][EMAIL] DKIM 2` |
| CNAME | `autodiscover` | `autodiscover.outlook.com` | `[INTERNAL][EMAIL] Outlook auto-config` |

- [ ] **Step 5: Verify mail records propagated**

Run:
```bash
dig MX allinonemanagementsolutions.net @8.8.8.8 +short
dig TXT allinonemanagementsolutions.net @8.8.8.8 +short
```

Expected: MX returns the M365 hostname; TXT includes SPF.

### Task 6.2: Create aliases on `aioms.net` for internal staff

**Files:** None.

- [ ] **Step 1: Create staff aliases**

User action: M365 admin → Users → for the primary mailbox owner, add aliases like:
- `ops@allinonemanagementsolutions.net`
- `admin@allinonemanagementsolutions.net`
- `support@allinonemanagementsolutions.net` (only if used internally — keep customer `support@` on `.com`)

For each alias, add a note in the M365 admin user notes field: `[INTERNAL] Staff-only operations alias`.

Expected: Aliases created. Sending a test email TO each alias arrives in the primary inbox.

- [ ] **Step 2: Test alias delivery**

User action: From an external account, send a test email to `ops@allinonemanagementsolutions.net`. Confirm it arrives in the primary mailbox.

### Task 6.3: Add `tmmtrentals.net` to Google Workspace

**Files:** None.

- [ ] **Step 1: Add as secondary domain in Google Admin**

User action: Google Admin → Domains → Manage domains → Add a domain → `tmmtrentals.net` → choose "Secondary domain" (not alias domain — secondary lets you create new emails).

- [ ] **Step 2: Add Google verification TXT record at GoDaddy**

User action: Google shows a verification TXT (something like `google-site-verification=...`). Add to GoDaddy with note `[INTERNAL][EMAIL] Google domain verification`.

- [ ] **Step 3: Click Verify in Google Admin**

Wait 5 min, click Verify.

Expected: Domain Verified.

- [ ] **Step 4: Add Google mail records (MX, SPF, DKIM)**

User action: Add to GoDaddy:

| Type | Name | Value | Note |
|---|---|---|---|
| MX | `@` | `1 SMTP.GOOGLE.COM` | `[INTERNAL][EMAIL] Google single-MX` |
| TXT | `@` | `v=spf1 include:_spf.google.com -all` | `[INTERNAL][EMAIL] SPF` |
| TXT | `google._domainkey` | *(from Google Admin → Gmail → Authenticate email — generate first)* | `[INTERNAL][EMAIL] DKIM` |

DKIM in Google requires generation first: Google Admin → Apps → Google Workspace → Gmail → Authenticate email → select `tmmtrentals.net` → Generate new record → copy TXT value to GoDaddy → wait for propagation → click Start authentication.

- [ ] **Step 5: Verify mail records propagated**

Run:
```bash
dig MX tmmtrentals.net @8.8.8.8 +short
dig TXT tmmtrentals.net @8.8.8.8 +short
dig TXT google._domainkey.tmmtrentals.net @8.8.8.8 +short
```

Expected: MX returns Google SMTP; SPF and DKIM TXT records present.

### Task 6.4: Create aliases on `tmmtrentals.net` for internal staff

**Files:** None.

- [ ] **Step 1: Create staff aliases**

User action: Google Admin → Users → primary mailbox owner → add aliases:
- `ops@tmmtrentals.net`
- `admin@tmmtrentals.net`

Note each alias as `[INTERNAL] Staff-only operations alias` in the user's admin notes.

- [ ] **Step 2: Test alias delivery**

User action: Send test from external account to `ops@tmmtrentals.net`. Verify delivery.

### Task 6.5: Add DMARC records (start at `p=none` for monitoring)

**Files:** None.

- [ ] **Step 1: Add DMARC to all 4 domains**

User action: For each of the 4 domains, add at GoDaddy:

| Type | Name | Value | Note |
|---|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@<same domain>` | `[EMAIL] DMARC monitor — ramp to quarantine after 2 weeks` |

Tags vary: `[PUBLIC][EMAIL]` for `.com`, `[INTERNAL][EMAIL]` for `.net`.

- [ ] **Step 2: Verify DMARC TXT propagated**

Run:
```bash
for d in allinonemanagementsolutions.com allinonemanagementsolutions.net tmmtrentals.com tmmtrentals.net; do
  echo "=== $d ==="
  dig TXT _dmarc.$d @8.8.8.8 +short
done
```

Expected: each returns `v=DMARC1; p=none; ...`.

- [ ] **Step 3: Calendar reminder — DMARC ramp**

User action: Add calendar reminder for 2 weeks from today: "Review DMARC aggregate reports → ramp to `p=quarantine; pct=25` if reports clean."

The full ramp schedule (per the spec):
- Week 0–2: `p=none`
- Week 2–4: `p=quarantine; pct=25`
- Week 4+: `p=quarantine; pct=100`
- Week 8+: `p=reject` (only if no legitimate mail being quarantined)

This is a deferred follow-up beyond this plan.

---

## Phase 7: Hardening — CAA records

**Do not run this phase until certs have been issued on all domains.** A CAA record added before cert issuance will block issuance.

### Task 7.1: Confirm certs issued on all live domains

**Files:** None.

- [ ] **Step 1: Verify cert issuer per domain**

Run:
```bash
for d in allinonemanagementsolutions.com tmmtrentals.com tmmtrentals.net admin.tmmtrentals.net; do
  echo "=== $d ==="
  echo | openssl s_client -servername $d -connect $d:443 2>/dev/null | openssl x509 -noout -issuer
done
```

Expected: All return an issuer. Note which CA each provider uses:
- Vercel: typically Let's Encrypt
- GHL: Let's Encrypt or DigiCert (depends on plan)

Record actual issuers — they determine the CAA values.

### Task 7.2: Add CAA records per domain

**Files:** None.

- [ ] **Step 1: Add CAA at GoDaddy for `.com` domains (GHL)**

User action: For both `.com` domains, add CAA records matching the issuer found in Task 7.1.

If GHL uses Let's Encrypt:
| Type | Name | Value | Note |
|---|---|---|---|
| CAA | `@` | `0 issue "letsencrypt.org"` | `[PUBLIC][HARDENING] GHL Let's Encrypt` |

If GHL uses DigiCert, swap the value. If both might be used (cert renewals can switch), add both:
| CAA | `@` | `0 issue "letsencrypt.org"` |
| CAA | `@` | `0 issue "digicert.com"` |

- [ ] **Step 2: Add CAA for `.net` domains (Vercel)**

User action: Vercel uses Let's Encrypt. Add:

| Type | Name | Value | Note |
|---|---|---|---|
| CAA | `@` | `0 issue "letsencrypt.org"` | `[INTERNAL][HARDENING] Vercel Let's Encrypt` |

- [ ] **Step 3: Verify CAA records present**

Run:
```bash
for d in allinonemanagementsolutions.com allinonemanagementsolutions.net tmmtrentals.com tmmtrentals.net; do
  echo "=== $d ==="
  dig CAA $d @8.8.8.8 +short
done
```

Expected: each returns CAA records. (Note: `allinonemanagementsolutions.net` still dormant — skip CAA for it until DNS exists.)

- [ ] **Step 4: Verify cert renewal still works**

This can't be tested immediately — Let's Encrypt certs renew every ~60 days. Add calendar reminder for 65 days from today: "Verify all SSL certs renewed post-CAA-record-addition."

If a renewal fails, the CAA record is misconfigured — revisit Task 7.2.

---

## Phase 8: Documentation

Capture the final state in a single source of truth and deprecate the now-stale `docs/DOMAIN-SETUP.md`.

### Task 8.1: Create `docs/INFRASTRUCTURE-INVENTORY.md`

**Files:** Create `docs/INFRASTRUCTURE-INVENTORY.md`.

- [ ] **Step 1: Write the inventory file**

Create the file with the following content (substitute actual values gathered during Phases 0–7):

```markdown
# AIXMOS Infrastructure Inventory

> Single source of truth for all infrastructure. Any change to infra (DNS / hosting / email / auth) must update this file in the same commit. Tag every entry `[PUBLIC]` (customer-facing on .com) or `[INTERNAL]` (staff-only on .net).

**Last updated:** YYYY-MM-DD
**Spec reference:** [docs/superpowers/specs/2026-05-20-aixmos-domain-architecture-design.md](superpowers/specs/2026-05-20-aixmos-domain-architecture-design.md)

---

## 1. Domains

| Domain | Tag | Host | Status |
|---|---|---|---|
| allinonemanagementsolutions.com | [PUBLIC] | GHL | Live |
| www.allinonemanagementsolutions.com | [PUBLIC] | GHL (redirect → apex) | Live |
| tmmtrentals.com | [PUBLIC] | GHL | Live |
| www.tmmtrentals.com | [PUBLIC] | GHL (redirect → apex) | Live |
| tmmtrentals.net | [INTERNAL] | Vercel `tmmt-c919` | Live, auth-gated |
| www.tmmtrentals.net | [INTERNAL] | Vercel (redirect → apex) | Live |
| admin.tmmtrentals.net | [INTERNAL] | Vercel `tmmt-c919` (same project) | Live |
| allinonemanagementsolutions.net | [INTERNAL] | Vercel (planned) | Dormant — no DNS yet |

## 2. DNS records (current state per domain)

[Paste current GoDaddy state from each domain here, with notes column reflecting the tags. Update on every change.]

## 3. Hosting projects

### Vercel
| Project | ID | Tag | Domains served |
|---|---|---|---|
| tmmt-c919 | prj_moZzMHYtwiZIS0TETOBOKODbp7eM | [INTERNAL] | tmmtrentals.net, www, admin |

### GHL
| Sub-account / site | Tag | Domain | Funnels / pages |
|---|---|---|---|
| AIXMOS parent-co | [PUBLIC] | aioms.com | landing, operator-apply, applicant-apply, thank-you |
| TMMT Rentals | [PUBLIC] | tmmtrentals.com | landing, fleet, book, contact |

## 4. Email

### Microsoft 365 (AIOMS)
| Domain | Tag | Primary mailbox | Aliases |
|---|---|---|---|
| allinonemanagementsolutions.com | [PUBLIC] | (your primary) | (list customer-facing aliases) |
| allinonemanagementsolutions.net | [INTERNAL] | (same tenant, alias domain) | ops@, admin@, ... |

### Google Workspace (TMMT)
| Domain | Tag | Primary mailbox | Aliases |
|---|---|---|---|
| tmmtrentals.com | [PUBLIC] | (your primary) | (list customer-facing aliases) |
| tmmtrentals.net | [INTERNAL] | (same workspace, secondary domain) | ops@, admin@, ... |

### DMARC status
| Domain | Policy | Next ramp date |
|---|---|---|
| (all 4) | `p=none` (monitor) | YYYY-MM-DD (+2 weeks) → quarantine |

## 5. Auth / identity

### Supabase
| Project | Tag | Used by | Roles in app_metadata |
|---|---|---|---|
| tmmt-rentals-internal | [INTERNAL] | tmmt-c919 (rental admin) | owner, admin, operator, executive, vendor, investor |

(Add `aioms-internal` row when credit-repair app is built.)

## 6. Change log

| Date | Change | By |
|---|---|---|
| YYYY-MM-DD | Initial inventory created per migration plan | (you) |
```

- [ ] **Step 2: Fill in actual values from Phases 0–7**

User action: Replace bracketed placeholders with real values from your records gathered during the migration. Specifically:
- DNS records section: current GoDaddy state for each of the 4 domains
- Email section: real primary mailbox addresses (redact if sensitive) and alias list
- DMARC next-ramp dates: today + 14 days

### Task 8.2: Deprecate `docs/DOMAIN-SETUP.md`

**Files:** Modify `docs/DOMAIN-SETUP.md`.

- [ ] **Step 1: Replace the file contents with a deprecation pointer**

Open `docs/DOMAIN-SETUP.md` and replace the entire contents with:

```markdown
# Domain Setup — DEPRECATED

> **This document is no longer current.** It described an older architecture where both `.com` and `.net` lived on the same Vercel project with host-based middleware routing.
>
> Current architecture: `docs/superpowers/specs/2026-05-20-aixmos-domain-architecture-design.md`
>
> Current operational state: `docs/INFRASTRUCTURE-INVENTORY.md`
>
> Deprecated on YYYY-MM-DD as part of the domain architecture migration.
```

Replace YYYY-MM-DD with the actual date.

### Task 8.3: Commit Phase 8 docs

**Files:** Stage and commit `docs/INFRASTRUCTURE-INVENTORY.md` and `docs/DOMAIN-SETUP.md`.

- [ ] **Step 1: Stage only the two doc files**

Run:
```bash
git add docs/INFRASTRUCTURE-INVENTORY.md docs/DOMAIN-SETUP.md
git status --porcelain
```

Expected: exactly two files staged. Nothing else.

- [ ] **Step 2: Commit**

Run:
```bash
git commit -m "$(cat <<'EOF'
Document AIXMOS domain architecture migration outcome

Creates docs/INFRASTRUCTURE-INVENTORY.md as the single source of
truth for current infrastructure state. Deprecates the old
docs/DOMAIN-SETUP.md (which documented the pre-migration host-based
routing architecture) with a pointer to the current spec and inventory.
EOF
)"
```

Expected: commit succeeds. `git log -1 --oneline` shows the new commit.

---

## Phase 9: Final verification (the spec's verification checklist)

Reproduce the verification checklist from the spec. Each item is a one-line check.

### Task 9.1: Run the full verification checklist

**Files:** None.

- [ ] **Step 1: Public sites live**

```bash
curl -sI https://allinonemanagementsolutions.com 2>&1 | head -1
curl -sI https://www.allinonemanagementsolutions.com 2>&1 | grep -i location
curl -sI https://tmmtrentals.com 2>&1 | head -1
curl -sI https://www.tmmtrentals.com 2>&1 | grep -i location
```

Expected: all return 200 (apex) or 301-to-apex (www).

- [ ] **Step 2: Internal site live, auth-gated, noindex header**

```bash
curl -sI https://tmmtrentals.net 2>&1 | head -1
curl -sI https://admin.tmmtrentals.net 2>&1 | head -1
curl -sI https://tmmtrentals.net 2>&1 | grep -i 'x-robots-tag'
curl -s https://tmmtrentals.net/robots.txt
```

Expected: 200 (login page), 200 (login page), `noindex, nofollow`, `Disallow: /`.

- [ ] **Step 3: `aioms.net` dormant**

```bash
dig allinonemanagementsolutions.net @8.8.8.8 +short
```

Expected: no answer (or NXDOMAIN). Confirms no accidental DNS records.

- [ ] **Step 4: Email tenants own the `.net` domains**

User action: M365 admin → Domains shows `allinonemanagementsolutions.net` Verified. Google Admin → Domains shows `tmmtrentals.net` Verified. Test sends to `ops@aioms.net` and `ops@tmmtrentals.net` arrive in respective primary inboxes.

- [ ] **Step 5: Inventory and deprecation docs in place**

```bash
test -f docs/INFRASTRUCTURE-INVENTORY.md && echo OK
head -1 docs/DOMAIN-SETUP.md  # expect "# Domain Setup — DEPRECATED"
```

Expected: both pass.

- [ ] **Step 6: Update the inventory file with final verification date**

User action: Edit `docs/INFRASTRUCTURE-INVENTORY.md`, set `Last updated:` to today, add a change-log entry. Commit.

```bash
git add docs/INFRASTRUCTURE-INVENTORY.md
git commit -m "Update INFRASTRUCTURE-INVENTORY.md after final verification"
```

---

## Open follow-ups (not in this plan)

The following items from the spec are not addressed here and need their own plans:

1. **TMMT codebase refactor** — prerequisite. Write this plan **before** executing Phase 3 of this plan.
2. **Subdomain SSO cookie scoping** — set Supabase auth cookie domain to `.tmmtrentals.net` (with leading dot) so sessions carry across subdomains. Small follow-up in the refactor plan.
3. **Future `aioms.net` app** — credit-repair + AIXMOS command center. Needs its own brainstorm + spec + plan.
4. **Customer portal apps** — `portal.tmmtrentals.com` and `portal.aioms.com`. Each its own brainstorm.
5. **`apply.*.com` funnels** — GHL funnel content workstream, not a code plan.
6. **DMARC ramp** — calendar-driven, not session-driven. Reviewed every 2 weeks.
7. **HSTS preload** — security hardening for after the system is proven stable (~3–6 months).

---

## Rollback summary

| Phase | Reversibility |
|---|---|
| 0 | No changes made — nothing to roll back |
| 1 | GHL sites can stay built; no DNS impact |
| 2 | Re-attach `.com` and/or `.net` to Vercel `tmmt-c919` and re-add GoDaddy DNS for `aioms.net` if Task 2.2 was already executed — ~10 min |
| 3 | Revert GoDaddy DNS to Vercel values + re-attach in Vercel — within TTL (10 min) |
| 4 | Greenfield — just delete the records to revert |
| 5 | Detach `.net` domains in Vercel + delete GoDaddy records — staff lose access but no customer impact |
| 6 | M365 / Google: remove the secondary domain (mail will hard-fail to that domain after) |
| 7 | Delete CAA records at GoDaddy — cert renewals return to normal |
| 8 | Revert the two commits via `git revert` |

The plan is reversible end-to-end. The riskiest window is Phase 3 (`.com` DNS cut-over) — TTL of 600s caps the worst-case outage at 10 minutes.
