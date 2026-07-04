# GHL Multi-Agency — any business, any agency, serves every client

> X and Moe Legacy each run **their own GoHighLevel agency account**. Any business
> created under **either** agency must serve clients at **any scope** and plug into
> the empire — staying clean, healthy, stable, and reliable for everyday use.
>
> The architecture already supports this: **every GHL setting is per-business env.**
> A business is a tenant; it carries its own GHL keys; it runs independently.

---

## 1. The model — one engine, many isolated tenants

```
        THE EMPIRE (AIXMOS engine + shared patterns: tags, funnel, mission)
          │                                   │
   ┌──────┴───────┐                    ┌──────┴───────┐
   X's GHL AGENCY                      MOE LEGACY's GHL AGENCY
   ├─ Business A (own sub-acct + env)  ├─ Business D (own sub-acct + env)
   ├─ Business B (own sub-acct + env)  ├─ Business E (own sub-acct + env)
   └─ Business C …                     └─ Business F …
```

- **Each business = its own deployment + its own GHL sub-account + its own env.**
- Businesses **never share credentials or data** — one's load or outage can't touch
  another (that's what keeps the whole empire *stable and reliable across the board*).
- They **share the engine + patterns** (the AIXMOS app, the tag/funnel conventions,
  the mission), so any of them delivers the same end result regardless of which
  agency owns it.

## 2. Why it already works (it's all env-driven)
Every GHL integration point reads from environment variables — nothing is hardcoded
to one agency:
- `GHL_API_KEY` · `GHL_BASE` · `GHL_LOCATION_ID` · `GHL_WEBHOOK_SECRET`
- checkout URLs (`GHL_CHECKOUT_*`), pipeline/stage maps (`GHL_STAGE_OPS_JSON`,
  `GHL_CASE_STATUS_MAP_JSON`), alerts (`GHL_CLIENT_ALERTS`), KPI patterns, etc.

→ So a new business under **any** agency just sets **its own** values and runs.

## 3. Stand up a new business (under X's OR Moe's agency)
1. In that agency, create the business's **GHL sub-account (location)**.
2. New **Supabase project** for it (data isolation + RLS) and a **Vercel deploy**.
3. Set its env (`.env` from `.env.legacy.example`): its own `GHL_API_KEY`,
   `GHL_LOCATION_ID`, `GHL_WEBHOOK_SECRET`, checkout URLs, and its **portal brand**
   (`NEXT_PUBLIC_PORTAL=…`, see `docs/PORTAL-SIGNIN.md`).
4. Point GHL webhooks at the deploy (`/api/webhooks/ghl`) with the shared secret.
5. Smoke-test: a lead flows in → pipeline → client served. Done.

It now serves any client at any scope, independently, under whichever agency owns it.

## 4. Clean · healthy · stable (everyday reliability)
- **Isolation = stability.** Separate GHL sub-accounts + separate Supabase per
  business means a problem in one never cascades. The empire stays up even if one
  business is mid-change.
- **Fail-safe webhook auth** (`src/lib/ghl/webhook-auth.ts`) rejects when the secret
  is unset — no silent bad data.
- **Health at a glance** — per-vertical health checks + the fact-check gate keep every
  deploy green; nothing ships broken.
- **Owner control** — access, secrets, and editions stay gated to X (and Moe for
  their own agency), revocable instantly.

## 5. The empire connection
Businesses connect to the empire through **shared conventions, not shared
credentials**: the AIXMOS engine, the tag/funnel language, the mission and standard.
That's how a client onboarded in *any* business gets the same dignified, verified
end result — while each business stays its own clean, walled tenant.

---

_Config: `.env.legacy.example` (per-business GHL keys) · `docs/PORTAL-SIGNIN.md`
(per-business branded sign-in) · `docs/GHL-PIPELINE-SETUP.md` (pipeline) ·
`docs/DATA-ACCESS-CHARTER.md` (isolation). The owner is referred to only as **X**._
