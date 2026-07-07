# AIXMOS Domain Architecture — Design Spec

**Date:** 2026-05-20
**Status:** Draft — pending owner review
**Author:** Planning pass with Taha
**Scope:** Architecture + DNS + email + auth/noindex policy + inventory labels. **No code changes in this spec** — a separate implementation plan will cover the TMMT codebase refactor.

---

## Overview

AIXMOS is the umbrella parent product. Two verticals sit under it today (TMMT Rentals and a planned credit-repair app), each represented by a `.com`/`.net` domain pair. This spec defines a **strict public/private separation**: every `.com` domain is customer-facing on GHL (GoHighLevel); every `.net` domain is staff-only on Vercel with authentication and `noindex` enforcement.

This spec **replaces** the architecture documented in `docs/DOMAIN-SETUP.md`, which currently has both `.com` and `.net` attached to the same Vercel project (`tmmt-c919`) and routed via host-based middleware. The new architecture separates them at the hosting layer.

---

## Goals & Non-Goals

### Goals

- Strict public/private separation at the **hosting layer**, not just at the routing layer
- All public marketing/intake on GHL; all internal staff tools on Vercel
- Every `.net` domain requires auth and serves `X-Robots-Tag: noindex, nofollow`
- DNS, email, and hosting entries carry a consistent `[PUBLIC]` / `[INTERNAL]` label so future readers can't confuse them
- Low email overhead — keep current providers (M365 for AIOMS, Google Workspace for TMMT), alias `.net` domains into the existing tenants
- `www → apex` redirect convention across all 4 domains
- Add no DNS records that point nowhere — dormant domains stay dormant

### Non-Goals

- Migrating either email tenant from one provider to the other
- Building the credit-repair / AIXMOS command-center app at `allinonemanagementsolutions.net`
- Building the customer-facing portal apps at `portal.aioms.com` / `portal.tmmtrentals.com`
- Refactoring the existing TMMT codebase to remove `.com` host detection (separate plan)
- Building the GHL funnels themselves (page content is its own workstream)

---

## Current State (so the deltas are honest)

- **Registrar:** GoDaddy for all 4 domains
- **Vercel project `tmmt-c919`** (Project ID `prj_moZzMHYtwiZIS0TETOBOKODbp7eM`) currently has both `allinonemanagementsolutions.com` and `allinonemanagementsolutions.net` attached. `middleware.ts` host-routes between them.
- **TMMT codebase** at `/Users/ceo.moe/TMMT` is a Next.js 16 + Supabase + Sentry app. The existing `(admin)/` route group (17 pages) IS the rental admin.
- **`tmmtrentals.com`** and **`tmmtrentals.net`** are not currently wired up in DNS or attached to any Vercel project.
- **AIXMOS public static files** live inside the TMMT repo at `AIXMOS/public/` — these get rewritten via middleware when `.com` traffic hits `tmmt-c919`. After this spec, those assets move to GHL.
- **Email today:**
  - AIOMS — Microsoft 365 (one mailbox on `allinonemanagementsolutions.com`)
  - TMMT — Google Workspace (one mailbox on `tmmtrentals.com`)
- **Existing `.com` content:** AIXMOS static landing + apply/operator/thank-you pages live inside the TMMT app at `AIXMOS/public/`. These move to GHL when the cut-over happens.

---

## Architecture

### Domain map

| Domain | Hosting | Audience | Status |
|---|---|---|---|
| `allinonemanagementsolutions.com` | **GHL** | Public — prospects, applicants | Configure now |
| `tmmtrentals.com` | **GHL** (separate site/sub-account) | Public — rental customers | Configure now |
| `allinonemanagementsolutions.net` | **Vercel** (future project) | Internal — AIXMOS staff + credit-repair admin | **Dormant** — no DNS until app exists |
| `tmmtrentals.net` | **Vercel** — `tmmt-c919` (existing) | Internal — rental ops staff | Configure now |

### Subdomain map

```
allinonemanagementsolutions.com  (GHL)
  @         🟢 public marketing site
  www       🟢 redirect → apex
  apply     ⏸ planned — operator/applicant intake funnel (GHL)
  portal    ⏸ planned — future Vercel client portal app

allinonemanagementsolutions.net  (Vercel — DORMANT)
  @         ⏸ planned — credit-repair + AIXMOS command center
  admin     ⏸ planned
  ops       ⏸ planned
  docs      ⏸ planned
  → No DNS records at GoDaddy until the app exists.

tmmtrentals.com  (GHL)
  @         🟢 public rentals marketing site
  www       🟢 redirect → apex
  apply     ⏸ planned — rental application funnel (GHL)
  portal    ⏸ planned — future Vercel tenant/owner portal

tmmtrentals.net  (Vercel — tmmt-c919, existing)
  @         🟢 staff landing/login
  admin     🟢 admin dashboard (existing /admin routes)
  ops       ⏸ planned — add when /ops routes exist
  docs      ⏸ planned — add when /docs routes exist
```

🟢 = configure now at GoDaddy / ⏸ = planned, do not configure yet

### Why a subdomain split instead of paths

Each `.net` subdomain is its own origin, which gives:
- Distinct cookie scopes (defense in depth — a compromised cookie on one tool doesn't grant access to others by default)
- Independent SSL certificates and routing rules
- Cleaner bookmark/discoverability for staff (`admin.tmmtrentals.net` reads better than `tmmtrentals.net/admin`)
- Easier future migration if one subdomain needs different hosting

SSO across subdomains is handled via cookies scoped to `.tmmtrentals.net` (note the leading dot). This is a one-line configuration when the auth code is touched.

### Why GHL for `.com` and not Vercel

The user has explicitly chosen GHL for marketing/funnels. GHL provides built-in funnel builders, form handling, CRM, and operator/applicant pipelines that would otherwise require building. Vercel hosts the staff-only `.net` apps where custom application logic is needed.

`apply.*.com` runs as GHL funnels. `portal.*.com` will eventually run as Vercel apps (they're stateful customer-login apps) — this crosses the GHL/Vercel boundary but **respects Rule #6** because `portal` is a separate Vercel project from the `.net` internal admin.

---

## DNS Records

### Conventions

- **Registrar:** GoDaddy for all 4 domains
- **TTL:** 600s (10 min) during initial setup; raise to 3600s once verified
- **GoDaddy parking records must be removed** before pasting Vercel/GHL records (default `@ → Parked` A records conflict)
- **Notes field on each record** must carry the `[PUBLIC]` or `[INTERNAL]` tag (see Inventory Labels section)

### `allinonemanagementsolutions.com` — public marketing (GHL)

| Status | Type | Name | Value | Note |
|---|---|---|---|---|
| 🟢 | A | `@` | *(from GHL custom-domain dashboard at setup time)* | `[PUBLIC] AIOMS marketing — GHL apex` |
| 🟢 | CNAME | `www` | *(from GHL custom-domain dashboard)* | `[PUBLIC] www redirect via GHL` |
| ⏸ | CNAME | `apply` | *(from GHL)* | Add when funnel exists |
| ⏸ | — | `portal` | — | Future Vercel app — do not add yet |

GHL values vary by sub-account / region — always copy live values from the GHL dashboard at setup time, not from this spec.

### `tmmtrentals.com` — public rentals (GHL)

| Status | Type | Name | Value | Note |
|---|---|---|---|---|
| 🟢 | A | `@` | *(from GHL custom-domain dashboard)* | `[PUBLIC] TMMT marketing — GHL apex` |
| 🟢 | CNAME | `www` | *(from GHL custom-domain dashboard)* | `[PUBLIC] www redirect via GHL` |
| ⏸ | CNAME | `apply` | *(from GHL)* | Add when rental application funnel exists |
| ⏸ | — | `portal` | — | Future Vercel app — do not add yet |

Use a **separate GHL sub-account/site** for TMMT vs AIOMS — they're distinct brands with distinct funnels.

### `tmmtrentals.net` — internal staff (Vercel `tmmt-c919`)

| Status | Type | Name | Value | Note |
|---|---|---|---|---|
| 🟢 | A | `@` | `76.76.21.21` | `[INTERNAL] Vercel apex — staff app` |
| 🟢 | CNAME | `www` | `cname.vercel-dns.com` | `[INTERNAL] www → apex (configure in Vercel)` |
| 🟢 | CNAME | `admin` | `cname.vercel-dns.com` | `[INTERNAL] Routes to tmmt-c919 — same project as @` |
| ⏸ | — | `ops` | — | Add when `/ops` route exists in app |
| ⏸ | — | `docs` | — | Add when `/docs` route exists in app |

All three configured subdomains attach to the **same Vercel project** (`tmmt-c919`). The app's middleware reads `host` header to serve the appropriate section (or rewrite to the appropriate route).

Vercel apex IP `76.76.21.21` matches existing `docs/DOMAIN-SETUP.md`. Vercel may surface `216.198.79.1` in the dashboard at setup time — use whichever the dashboard shows on the day.

### `allinonemanagementsolutions.net` — internal staff (Vercel, **DORMANT**)

**No DNS records.** The whole domain stays unresolved at the registrar until the credit-repair / AIXMOS command-center app exists. Adding records to a non-existent app produces dead URLs that confuse staff and risk accidental indexing if the records leak elsewhere.

When the app is ready, the records follow the same pattern as `tmmtrentals.net` above:
- `@` A `76.76.21.21`
- `www` CNAME `cname.vercel-dns.com`
- `admin` CNAME `cname.vercel-dns.com`
- `ops` and `docs` deferred until those routes exist

### Hardening — CAA records (after initial validation)

For each domain, after Vercel/GHL have issued SSL certs successfully:

| Type | Name | Value | Note |
|---|---|---|---|
| CAA | `@` | `0 issue "letsencrypt.org"` | `[HARDENING] Vercel uses Let's Encrypt` |
| CAA | `@` | `0 issue "digicert.com"` | `[HARDENING] GHL may use DigiCert on certain plans` |

**Do not add CAA records before certs are issued** — an early CAA blocking your provider will prevent cert issuance.

Verify the exact CA used by each provider before applying. Lock down only after confirming.

### Records to delete at GoDaddy before pasting new ones

Per domain, remove:
- Default `@` A record → GoDaddy parking
- Default `www` CNAME → `@` (if present)
- GoDaddy "Forwarding" rules (conflict with provider-managed redirects)

---

## Email Plan

### Provider mapping

| Brand | Provider | Action |
|---|---|---|
| AIOMS (`.com` + `.net`) | **Microsoft 365** (existing) | Add `allinonemanagementsolutions.net` as a **second domain** on the existing tenant. Aliases route to existing inbox. |
| TMMT (`.com` + `.net`) | **Google Workspace** (existing) | Add `tmmtrentals.net` as a **secondary domain** on the existing workspace. Aliases route to existing inbox. |

Do not migrate between providers. Migration carries delivery risk and time cost with no upside since both providers already work.

### Naming convention

- **`.com` addresses** = customer-facing only (e.g., `support@aioms.com`, `bookings@tmmtrentals.com`)
- **`.net` addresses** = internal staff only (e.g., `ops@aioms.net`, `admin@tmmtrentals.net`)
- Never expose `.net` addresses on public sites, forms, or marketing

### When team grows

- **Alias** — free, shared inbox; appropriate for role addresses (`support@`, `ops@`) owned by one person
- **Per-user mailbox** — paid seat (~$6–12/mo M365, ~$6–18/mo Google); appropriate when an individual needs their own login + inbox

### Email DNS records by domain

**`allinonemanagementsolutions.com` (Microsoft 365):**

| Type | Name | Value | Note |
|---|---|---|---|
| MX | `@` | `<tenant>-com.mail.protection.outlook.com` priority 0 | `[PUBLIC][EMAIL] M365 — verify, do not change` |
| TXT | `@` | `v=spf1 include:spf.protection.outlook.com -all` | `[PUBLIC][EMAIL] SPF` |
| CNAME | `selector1._domainkey` | *(from M365 admin)* | `[PUBLIC][EMAIL] DKIM 1` |
| CNAME | `selector2._domainkey` | *(from M365 admin)* | `[PUBLIC][EMAIL] DKIM 2` |
| CNAME | `autodiscover` | `autodiscover.outlook.com` | `[PUBLIC][EMAIL] Outlook auto-config` |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@aioms.com` | `[PUBLIC][EMAIL] DMARC monitor` |

**`allinonemanagementsolutions.net` (Microsoft 365, added as second domain):** Same record set, under `.net`. Add when ready — M365 admin walks through it during domain addition.

**`tmmtrentals.com` (Google Workspace):**

| Type | Name | Value | Note |
|---|---|---|---|
| MX | `@` | `1 SMTP.GOOGLE.COM` | `[PUBLIC][EMAIL] Google single-MX (2023+)` |
| TXT | `@` | `v=spf1 include:_spf.google.com -all` | `[PUBLIC][EMAIL] SPF` |
| TXT | `google._domainkey` | *(from Google Admin)* | `[PUBLIC][EMAIL] DKIM` |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@tmmtrentals.com` | `[PUBLIC][EMAIL] DMARC monitor` |

**`tmmtrentals.net` (Google Workspace, added as secondary domain):** Same set, under `.net`. Add when ready.

### DMARC ramp

1. Week 0-2: `p=none` — receive aggregate reports, see what mail flows under each domain
2. Week 2-4: `p=quarantine; pct=25` — soft-quarantine 25% of failing mail
3. Week 4+: `p=quarantine; pct=100` — quarantine all failing mail
4. Week 8+ (if no legitimate mail is being quarantined): `p=reject` — strictest policy

Skipping the ramp risks blocking legitimate mail you didn't know about (third-party senders, forwarders, etc.).

---

## Auth Gating on `.net` (Rule #4)

### `tmmtrentals.net` (existing TMMT app)

Already enforced in `middleware.ts`:
- Unauthenticated request → redirect to `/login`
- Authenticated user without sufficient role → bounce to `.com` login or error
- `app_metadata.role` claim on Supabase user controls tier (owner/admin/operator/etc.)

Rule #4 is met by the existing auth gate. **However**, the current "bounce to `.com` login" behavior breaks after this spec executes: the middleware redirects to `https://allinonemanagementsolutions.com/login`, but `.com` will be on GHL after cut-over and GHL won't serve a `/login` page. **This is a hard prerequisite for the code refactor plan:** unauthenticated `.net` traffic must render the `.net` app's own login page (already at `/login` in the existing app), not redirect cross-domain. The refactor will remove `publicSiteOrigin()` usage for login redirects.

### `allinonemanagementsolutions.net` (future)

When the credit-repair / AIXMOS command-center app is built:
- Reuse the existing pattern: Supabase auth + middleware + `app_metadata.role` gate
- Same redirect-to-`.com`-login behavior for unauthenticated traffic

### Open question — Supabase project structure across `.net` apps

Two `.net` apps, two choices:
- **One shared Supabase project** — unified staff identity, single user table, single set of `app_metadata.role` values. Simpler SSO across verticals.
- **Two separate Supabase projects** — full tenant isolation, simpler RLS per vertical, easier to grant access per business unit.

**Recommendation:** separate Supabase projects per vertical, decided when the credit-repair app is built. Reasoning: data isolation is hard to undo later, and the two verticals (rentals vs credit repair) have very different schemas. Cross-vertical identity can be solved with shared SSO (e.g., Auth0 or Supabase third-party JWT) without coupling the data layer.

---

## `noindex` Enforcement on `.net` (Rule #5) — defense in depth

Three layers applied in order of strength:

1. **HTTP header (strongest):** `X-Robots-Tag: noindex, nofollow, noarchive` on every response from any `.net` domain. Works for non-HTML responses (JSON APIs, PDFs) where meta tags don't reach. Added in middleware.
2. **HTML meta tag:** `<meta name="robots" content="noindex, nofollow" />` in the root layout. Belt-and-suspenders for crawlers that ignore headers.
3. **robots.txt:** `User-agent: *\nDisallow: /` served from each `.net` domain. Polite signal — well-behaved bots respect it.

**Plus:** zero outbound links from `.com` → `.net`. No "staff login" link visible on any public site. No `.net` URLs in any sitemap, structured data, or social sharing meta tags.

The existing `middleware.ts` already does not serve public content on `.net` (forms get redirected to `.com`), which limits crawl surface even further. Belt + suspenders + locked door.

---

## Inventory Labels (Rule #9)

### Tag convention

| Tag | Meaning |
|---|---|
| `[PUBLIC]` | Serves customer-facing traffic on a `.com` domain |
| `[INTERNAL]` | Serves staff-only traffic on a `.net` domain (auth required) |
| `[EMAIL]` | Mail-related DNS record (MX/SPF/DKIM/DMARC) |
| `[HARDENING]` | Security record (CAA, future HSTS preload, etc.) |

### Where each tag goes

**GoDaddy DNS** — Notes field on each record (see DNS Records tables above for examples)

**Vercel project names + descriptions:**

| Project | Description |
|---|---|
| `tmmt-c919` (existing) | `[INTERNAL] TMMT rentals admin — serves tmmtrentals.net only` |
| Future `aioms-internal` | `[INTERNAL] AIXMOS command center + credit repair` |
| Future `tmmt-portal-public` | `[PUBLIC] Tenant/owner portal at portal.tmmtrentals.com` |

**GHL sites/sub-accounts:**

| GHL site | Label |
|---|---|
| AIOMS marketing | `[PUBLIC] AIXMOS parent-co — aioms.com` |
| TMMT rentals marketing | `[PUBLIC] TMMT Rentals — tmmtrentals.com` |

**Supabase projects:**

| Project | Name |
|---|---|
| Existing TMMT | `tmmt-rentals-internal` |
| Future credit-repair | `aioms-internal` |

**Email aliases:** include the `[PUBLIC]` or `[INTERNAL]` tag in the admin console notes field for each alias.

### Single source of truth — `docs/INFRASTRUCTURE-INVENTORY.md`

A new file lists every piece of infrastructure with its tag. Sections:

1. **Domains** — all 4, with status + host
2. **DNS records** — current state per domain
3. **Hosting projects** — Vercel + GHL with project IDs and what each serves
4. **Email** — providers, primary inboxes, aliases, DMARC status
5. **Auth/identity** — Supabase projects, role conventions
6. **Change log** — date-stamped list of infra changes

**Rule:** any infrastructure change updates this file in the same commit. Not a follow-up — same commit. Otherwise the inventory drifts and the labels become a lie.

This file is created as part of executing this spec (during the implementation plan), not as part of writing the spec.

---

## Migration Sequence (the order matters)

The cut-over from current state to target state must be sequenced so customers and staff never hit a broken state. High-level order:

1. **Build the two GHL public sites first** — both `aioms.com` and `tmmtrentals.com` content + funnels. **Do not point DNS yet.** GHL provides preview URLs for testing.
2. **In Vercel `tmmt-c919`** — detach `allinonemanagementsolutions.com` from the project. Do this *after* the GHL site is verified and *before* changing GoDaddy DNS, so traffic doesn't dead-end.
3. **In GoDaddy** — repoint `allinonemanagementsolutions.com` A/CNAME to GHL values. Wait for SSL to validate (Vercel may take ~10min, GHL similar).
4. **For `tmmtrentals.com`** — at GoDaddy, paste new A/CNAME records for GHL. (No prior Vercel attachment to detach — this is greenfield.)
5. **For `tmmtrentals.net`** — at GoDaddy, paste apex + `www` + `admin` records (Vercel). In Vercel `tmmt-c919`, add the three domains. Wait for SSL.
6. **Add `.net` email domains** — M365 admin to add `aioms.net`; Google Admin to add `tmmtrentals.net`. Create aliases.
7. **Add CAA records last** — only after all certs have issued.
8. **Create `docs/INFRASTRUCTURE-INVENTORY.md`** — capture the final state.
9. **Deprecate `docs/DOMAIN-SETUP.md`** — replace with a one-line pointer to this spec and the new inventory file.

The **code refactor** (removing `.com` host detection from the existing TMMT app, adding the `X-Robots-Tag` header, removing `AIXMOS/public/` static files, **changing the unauthenticated-redirect target from `.com/login` to the `.net` app's own `/login`**) is a separate plan and is a **hard prerequisite for step 3** (the `.com` DNS cut-over). Order:

1. Complete the code refactor and deploy `tmmt-c919` with the new behavior
2. Verify `.net` login flow no longer depends on `.com`
3. Then proceed with steps 1–9 above

Skipping the refactor before step 3 leaves unauthenticated `.net` visitors redirected to a now-nonexistent `.com/login` URL.

### Rollback

If a step fails:
- Step 1-2: zero impact, no DNS changes yet
- Step 3 (DNS cut-over): TTL set to 600s makes revert ≤10min. Re-attach `.com` to `tmmt-c919` in Vercel, revert GoDaddy A record to `76.76.21.21`.
- Step 5: if `.net` SSL doesn't validate, the domain is just unreachable — no customer impact since it's internal-only. Roll forward, not back.

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| GHL DNS values change between this spec and setup | Always copy live values from GHL dashboard at setup time. Spec deliberately uses placeholders. |
| Existing `tmmt-c919` middleware still expects `.com` host header after cut-over | The code refactor plan is a prerequisite for clean operation, but not a hard blocker (host-based middleware branches on `.com` simply won't fire if `.com` never reaches the project). Still — plan the refactor in the same window. |
| Email migration breaks during `.net` domain addition | Adding a second domain to M365 or Google doesn't touch the primary domain's mail flow. Safe to do. Only DNS records *for* the new `.net` domain are added; existing `.com` records untouched. |
| CAA record added too early, blocks cert issuance | Migration sequence places CAA last (step 7). Never first. |
| Staff bookmark `aioms.com/admin` and break when `.com` moves to GHL | `tmmtrentals.com` is greenfield (no prior staff bookmarks), but `aioms.com/admin` may have been used while it was attached to `tmmt-c919`. Add a temporary redirect rule in GHL: `aioms.com/admin` → `admin.aioms.net` (when that app exists) or `tmmtrentals.net/admin`. Remove after a few months once staff retrain. |
| Cross-domain login redirect breaks at cut-over | Current middleware bounces unauthenticated `.net` traffic to `aioms.com/login`. Once `.com` is on GHL, that path 404s. Mitigation: the code refactor plan (prerequisite) must change the redirect target to the `.net` app's own `/login`. Without the refactor, `.net` will be unreachable for unauthenticated visitors after step 3. |
| Forgetting to detach `.com` from `tmmt-c919` before DNS changes | Sequence step 2 explicitly calls this out. Verify in the Vercel dashboard before changing GoDaddy. |

---

## Out of Scope (deferred to other specs/plans)

1. **TMMT codebase refactor** — removing `.com` host detection in `middleware.ts`, deleting `AIXMOS/public/`, adding `X-Robots-Tag` header. Its own plan.
2. **GHL site/funnel content** — page copy, funnel design, form fields, lead routing. Marketing/ops workstream.
3. **Credit-repair / AIXMOS command-center app** — new Next.js app for `aioms.net`. Its own brainstorm + design + plan.
4. **Customer portal apps** — Vercel apps for `portal.tmmtrentals.com` and `portal.aioms.com`. Each its own brainstorm.
5. **Operator subdomain** (`network.aioms.com` from the original `docs/DOMAIN-SETUP.md`) — if still wanted, add to a future spec.
6. **HSTS preload registration** for `.net` domains — security hardening for after the system is stable.

---

## Open Questions

1. **Subdomain hosting strategy for future `aioms.net`** — same one-project-multiple-subdomains pattern as `tmmtrentals.net`, or separate Vercel projects per subdomain? **Recommendation:** same pattern. Revisit if separation becomes valuable.
2. **Supabase project structure** across `.net` apps (covered above) — decision deferred to credit-repair app design.
3. **Single GHL agency account vs separate** — does AIOMS marketing and TMMT marketing share a GHL agency-level account with two sub-accounts, or are they entirely separate GHL instances? Affects billing and admin overhead. Owner decision.
4. **`.net` SSO across subdomains** — when the apps grow beyond `@` + `admin`, set Supabase cookie domain to `.tmmtrentals.net` (leading dot) so a session at `admin.` carries to `ops.` and `docs.`. Trivial config but worth doing right the first time.

---

## Verification (after implementation plan executes)

Each item should be verifiable in under a minute:

- [ ] `https://allinonemanagementsolutions.com` → GHL marketing site, SSL valid
- [ ] `https://www.allinonemanagementsolutions.com` → redirects to apex
- [ ] `https://tmmtrentals.com` → GHL rentals site, SSL valid
- [ ] `https://www.tmmtrentals.com` → redirects to apex
- [ ] `https://tmmtrentals.net` → Vercel app login screen, SSL valid
- [ ] `https://admin.tmmtrentals.net` → Vercel app admin (after login), SSL valid
- [ ] `curl -I https://tmmtrentals.net` → response includes `X-Robots-Tag: noindex, nofollow`
- [ ] `https://tmmtrentals.net/robots.txt` → `User-agent: *\nDisallow: /`
- [ ] `dig allinonemanagementsolutions.net` → no answer (domain dormant)
- [ ] M365 admin → `allinonemanagementsolutions.net` listed as a domain, alias e.g. `ops@aioms.net` routes to primary inbox
- [ ] Google Admin → `tmmtrentals.net` listed as a secondary domain, alias e.g. `ops@tmmtrentals.net` routes to primary inbox
- [ ] `docs/INFRASTRUCTURE-INVENTORY.md` exists, lists all current state with `[PUBLIC]`/`[INTERNAL]` tags
- [ ] `docs/DOMAIN-SETUP.md` deprecated with a pointer to this spec and the inventory file

---

## References

- Existing: `docs/DOMAIN-SETUP.md` (to be deprecated)
- Existing: `docs/superpowers/specs/2026-05-17-command-center-architecture-design.md` (related — portfolio command center)
- Existing: `DEPLOY.md` (Vercel project info — `tmmt-c919`)
- Existing: `middleware.ts` (current host-based routing — to be refactored)
- Existing: `src/lib/site-domains.ts` (host detection helpers — to be simplified)
