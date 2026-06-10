# Operator start here

**Read this first.** You sell and funnel prospects. The platform handles checkout, onboarding, and coaching. You never touch code, env vars, or Supabase.

## Your 3 bookmarks

1. **Login** — https://tmmt-command-center.vercel.app/login → lands on `/operator`
2. **What you sell** — https://tmmt-ops.vercel.app/kits and https://tmmt-ops.vercel.app/build (public pitch pages — use ops, not command-center)
3. **Lead intake** — https://tmmt-ops.vercel.app/forms/lead-intake

## Day one

1. Send prospects to **lead intake** (or enter them yourself).
2. Funnel order: rental → **$97/mo membership** → credit guidance → `/build` / `/kits`.
3. You get paid on **collected sales** — owner sets your affiliate code at signup.

## Compliance (non-negotiable)

Say **credit guidance, coach, guide, plan**. Never **credit repair, fix your credit, guarantee, 100%**.

## What you cannot access (by design)

No CRM, fleet, payments, API keys, or other operators' data. Questions → owner.

---

**Full operator doc:** [`OPERATOR-START-HERE.md`](../OPERATOR-START-HERE.md) (repo root)

**Owner provisioning:**

```bash
node scripts/provision-operators.mjs --email sam@x.com --role operator
node scripts/provision-operators.mjs --file operators.csv --dry-run
node scripts/export-operators-from-airtable.mjs   # builds CSV from Airtable People
```

