# Operator start here

You funnel prospects. The system handles checkout, onboarding, and coaching. You never touch code, env vars, or Supabase.

---

## Your login

| | |
|---|---|
| **URL** | https://tmmt-command-center.vercel.app/login |
| **After login** | `/operator` — published instructions only |
| **Password** | One-time password from the owner — change it after first sign-in |

If login fails, contact the owner. Do not share your password.

---

## What you push (top of funnel)

Share these **public** links (no account needed). Use **`tmmt-ops.vercel.app`** — not command-center (command-center redirects `/kits` and `/build` to login):

| Link | Purpose |
|------|---------|
| https://tmmt-ops.vercel.app/forms/lead-intake | Main prospect form — start here |
| https://tmmt-ops.vercel.app/forms/affiliates | Affiliate program ($97 membership referrals) |
| https://tmmt-ops.vercel.app/forms/waitlist | Waitlist when fleet is full |
| https://tmmt-ops.vercel.app/kits | Flash-drive / kit offers |
| https://tmmt-ops.vercel.app/build | High-ticket done-for-you builds (deposits) |

Short paths also work on ops: `/forms/lead-intake`, `/kits`, `/build`.

**Your affiliate code:** the owner assigns this at signup. Append to links when instructed, e.g. `?ref=YOURCODE` or use the tracked link they give you. Commissions show in the affiliate program — paid monthly on collected sales.

---

## The funnel (what happens after you send someone)

```
Lead intake form → GHL pipeline → rental / $97 membership / credit guidance
                                      ↓
                              Upsells: /build, /kits, coaching
```

You are the **top-of-funnel engine**. CHUMMO / the back office handles follow-up, tags, and member onboarding.

---

## What you can see

- **`/operator`** — fact-checked instructions from the executive VA (read-only feed)
- **Public forms** — share freely

## What you cannot see (by design)

- Customer CRM, fleet, payments, settings
- Other operators’ data
- API keys, webhooks, Supabase, Vercel

This keeps customer data and IP protected. If you need something in the portal, ask the owner to publish an instruction.

---

## Daily checklist (2 minutes)

1. Open `/login` — sign-in form loads?
2. Open `/operator` — any new instructions?
3. Send **one** prospect link (`/forms/lead-intake` or your tracked URL)
4. Log outreach in your own sheet (name, date, link used) — optional but helps commissions

---

## Rules

- Do not promise credit scores, approvals, or funding amounts.
- One clear CTA per message (same as CHUMMO voice).
- Do not paste checkout links you made up — use owner-approved URLs only.
- Questions → owner / program lead, not Supabase or GitHub.

---

## More detail

- Full ops manual: [`docs/operator-team/OPERATOR_MANUAL.md`](docs/operator-team/OPERATOR_MANUAL.md)
- One-page cheat sheet: [`docs/operator-team/QUICK_REFERENCE.md`](docs/operator-team/QUICK_REFERENCE.md)
- Owner provisioning: `npm run provision-operators -- --file operators.csv` (owner only)

---

*For the people. By the people.*
