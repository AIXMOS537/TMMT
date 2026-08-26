# Open the public door, deploy from canon

> Written 2026-08-26. Two dashboard changes the Vercel API cannot make, plus the
> code change that makes them take effect. Do them in this order.

Today **no customer can reach the app.** `tmmt-ops` has Vercel SSO Deployment
Protection on, so every route — including `/forms/waitlist` and
`/forms/lead-intake` — answers `302 → vercel.com/sso-api`. A customer meets a
Vercel login wall, not the app. No lead can be submitted. See `ENVIRONMENTS.md`.

The setting is `all_except_custom_domains`, so **attaching a custom domain opens
the public door while leaving every preview URL protected.** That is why this
runbook attaches a domain rather than switching SSO off — switching it off would
expose the previews too.

---

## Step 1 — attach the domain (Vercel dashboard)

<https://vercel.com/aixmos537/tmmt-ops/settings/domains>

Add **`tmmtrentals.net`**. It matches `NEXT_PUBLIC_OWNER_HUB_HOST` in
`.env.example` and the intent recorded beside it: *staff-only .net on Vercel,
.com marketing on GHL*.

Vercel then shows the DNS record it wants. **Use the value Vercel displays** —
it varies by domain type and changes over time. An apex domain normally takes an
`A` record; `www` takes a `CNAME`.

## Step 2 — create that record (Google Cloud DNS)

Both `tmmtrentals.net` and `tmmtrentals.com` are registered and delegated to
Google Cloud DNS (`ns-cloud-b*.googledomains.com` for the `.net`). **Both zones
are empty** — SOA serial 1, no A record, nothing pointed anywhere. That is why
neither domain resolves today; it is not a propagation delay.

Google Cloud Console → Network Services → Cloud DNS → the `tmmtrentals.net`
zone → **Add standard** → enter the record Vercel gave you.

Vercel's domain page flips to *Valid Configuration* once it sees the record.

## Step 3 — repoint the production branch (Vercel dashboard)

<https://vercel.com/aixmos537/tmmt-ops/settings/git>

**Production Branch:** `m1/aixmos-credit-host` → `master`

Safe as of `c1ccc223`: `master` is a complete superset of that branch. Confirm
before switching — the second number must be `0`:

```bash
git rev-list --left-right --count origin/master...origin/m1/aixmos-credit-host
```

## Step 4 — the code change that makes step 3 matter

Already applied in this repo. `vercel.json` previously carried:

```json
"git": { "deploymentEnabled": false }
```

which disables git-triggered deploys **for every branch**. Repointing the
production branch would have changed nothing while that stood. It is now:

```json
"git": { "deploymentEnabled": { "master": true } }
```

Auto-deploy for `master` alone. Every other branch still needs a deliberate
deploy, so the owner-gated posture holds — this opens one lane, not the
floodgates. `scripts/vercel-ignore.sh` still skips builds when only docs or
scripts changed, so the free-tier quota is unaffected.

---

## Verify — run all three after steps 1–3

```bash
# 1. public door open — expect 200, NOT a redirect to vercel.com/sso-api
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://tmmtrentals.net/forms/waitlist

# 2. app auth gate still holds — expect 302 to /login
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://tmmtrentals.net/fleet

# 3. preview URLs still protected — expect 302 to vercel.com/sso-api
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://tmmt-ops-aixmos537.vercel.app/forms/waitlist
```

All three must hold together:

- (1) failing means the domain is not yet bypassing SSO — recheck the DNS record.
- (2) returning 200 means the app's own middleware is not gating. Stop and fix.
- (3) returning 200 means SSO was switched off rather than bypassed by domain,
  and previews are public too.

Then push an app-code change to `master` and confirm a deployment appears
against the `master` ref.

## Step 5 — only after the first successful `master` production deploy

Delete `m1/aixmos-credit-host`. Until that deploy is green it is the rollback.
