# START HERE — Operator 1-Pager

Welcome. You sell and onboard customers into the TMMT × AIXMOS offers. You work
in the browser — **no software to install, nothing to break.**

## Your 3 bookmarks
1. **Admin / your portal** — `https://<app-url>/login` → sign in with the
   credentials you were sent. You'll land on your portal (operator / vendor /
   partner). Change your password on first sign-in (or use **"Forgot password?"**).
2. **Public funnel** — `https://<app-url>/kits` and `/build` (what you're selling).
3. **Lead intake** — `https://<app-url>/forms/lead-intake` (drop a prospect in).

## What you do, day one
1. **Capture leads** → send prospects to `/forms/lead-intake` (or enter them for
   them). Every lead lands in the pipeline automatically.
2. **Funnel them through the offers, in order:**
   - 🚗 **Rental** — get them into a vehicle.
   - 💳 **$97/mo AIXMOS membership** — the recurring entry offer.
   - 📈 **Credit guidance** — the upsell (see vocabulary rules below).
   - 🏗️ **Builds & kits** — `/build` ($3,750–$50k done-for-you) and `/kits`
     ($97–$2,997 systems) for operators/dealers who want their own setup.
3. **You get paid** — referrals are tracked; affiliate commission pays on
   collected sales. (Owner: set the affiliate code on each checkout so the
   `/affiliates` payout view credits the right person.)

## ✅ Compliance vocabulary — non-negotiable
- Say **"credit guidance," "coach," "guide," "plan," "help," "may be able to."**
- **Never** say "credit repair," "fix your credit," "remove negative items,"
  "guarantee," "100%," or "no risk." (CROA — see `docs/sops/CREDIT-GUIDANCE-SOP.md`.)

## What you do NOT get (and why)
You get a **hosted login only** — never the code, the `.env`, API keys, or the
AI agents. That's deliberate: the platform stays the company's IP; you operate
it, you don't own it. (This is the zero-secret operator model from the OPK
design.)

---

## For the owner — provisioning these accounts (≈5 min)

```bash
# one operator:
node scripts/provision-operators.mjs --email sam@x.com --role operator

# bulk — CSV with header: email,role[,password]
node scripts/provision-operators.mjs --file operators.csv
```
Roles: `operator`, `vendor`, `partner` (investor view), `executive`, `admin`.
Passwords print once — send them securely; operators reset on first login.

### Two kinds of "the 5–10" (important)
- **Operators funneling for you** → shared org, **ready now**. They drive leads
  into your offers; no data isolation needed because the data is all yours.
- **Independent dealerships with their OWN private fleet/customers** → **not safe
  on the shared database yet.** Today every authenticated user can read all rows
  (`auth_all_*` RLS). Before onboarding a dealer who needs isolation, choose one:
  1. **Separate Supabase project per dealer** (full isolation, more ops), or
  2. **Add `org_id` + per-org RLS** to the core tables (one migration + policy
     pass — a real change, not same-day).
  Until then, sell dealers a **deployed kit/build** (their own instance you
  control) rather than a tenant on the shared DB.
