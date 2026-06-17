# Deploy & Launch — moe legacy (car rentals), Legacy edition

> The full rental operating platform for **moe legacy's owner**, running on
> **managed cloud only** (Vercel + Supabase + GoHighLevel). The AI backend "brain"
> is **withheld** (not purchased) — every rental-ops feature works; AI/agent
> features show an **"Upgrade to enable"** state until licensed. No NAS, no mesh,
> no dependency on your machines.
>
> Built by `scripts/build-projectaixmos-legacy.sh`. Ship this guide *with* the bundle.

---

## 1. What they get vs. what's gated

| Works now (managed cloud) | Gated until they buy the backend brain |
|---|---|
| Fleet, customers, bookings, payments, tickets, maintenance | AI triage / auto-replies |
| Public intake forms + customer pipeline | Agent swarm / mission auto-generation |
| Role logins, dashboards, reporting | Local-model / mesh features |
| GHL CRM + Stripe-via-GHL checkout | Anything needing `AIXMOS_BRAIN_URL` |

The edition flag `NEXT_PUBLIC_AIXMOS_EDITION=legacy` + blank `AIXMOS_BRAIN_URL`
keep the AI surface in upgrade-prompt mode. Nothing breaks; it just isn't on.

## 2. Prerequrisites (they own these accounts)

- A **Supabase** account (free tier fine to start).
- A **GoHighLevel** sub-account/location (CRM + payments).
- A **Vercel** account (Hobby fine to start).
- The Legacy bundle from `scripts/build-projectaixmos-legacy.sh --apply --build --git`.

## 3. Deploy (≈30–45 min, copy-paste)

```bash
# 0. You produced the bundle on your machine:
bash scripts/build-projectaixmos-legacy.sh --apply --build --git
#    → ../projectaixmos-legacy   (edition stamped, brain stripped)

cd ../projectaixmos-legacy
cp .env.legacy.example .env       # then fill in THEIR keys (below)
```

1. **Supabase (their project)**
   - Create a project → copy `Project URL`, `anon` key, `service_role` key into `.env`.
   - Run the migrations in `supabase/migrations/` (SQL editor or CLI). Confirm **RLS is on**
     (`20260331_enable_rls.sql`). They hold their own service-role key.
2. **GoHighLevel (their sub-account)**
   - Set up the rental pipeline + payment product (`docs/GHL-PIPELINE-SETUP.md`).
   - Put `GHL_WEBHOOK_SECRET` / `MISSION_WEBHOOK_SECRET` / `CRON_SECRET` in `.env`.
3. **Vercel (their team)**
   - Import the `projectaixmos-legacy` repo → set Environment Variables from `.env`
     (including `NEXT_PUBLIC_AIXMOS_EDITION=legacy`; leave `AIXMOS_BRAIN_URL` blank).
   - Deploy from `master`/`legacy/init`.
4. **Verify the build is green** (the bundle was built with `--build`, but confirm in Vercel).

## 4. Launch checklist (help them go live)

- [ ] **Fleet loaded** — their vehicles in the fleet table (CSV import or manual).
- [ ] **Intake forms live** — `/forms/customer-intake` (and rental booking) reachable + submitting.
- [ ] **Payments** — a GHL test checkout completes and tags the customer.
- [ ] **Roles** — owner + at least one staff login work; dashboards render.
- [ ] **Smoke test:**
  ```bash
  curl -sS -o /dev/null -w "ops login: %{http_code}\n" https://THEIR-APP.vercel.app/login
  curl -sS -o /dev/null -w "intake:    %{http_code}\n" https://THEIR-APP.vercel.app/forms/customer-intake
  ```
  Both `200`. Then run a real end-to-end booking.
- [ ] **AI surface** shows "Upgrade to enable" (confirms brain is correctly off).

## 5. The upgrade path (when they pay for the brain)

No re-deploy of the app — just light it up:
1. They purchase → you issue a license key (`AIXMOS-XXXX-XXXX-XXXX-XXXX`).
2. Set in Vercel env: `AIXMOS_LICENSE_KEY=<key>` and `AIXMOS_BRAIN_URL=<hosted brain endpoint>`.
3. Redeploy. AI/agent features flip on; metered against their license.
4. (Later) they can stand up their *own* brain via `docs/LOCAL-FIRST-AI-STACK.md` —
   the same app, just pointed at a local router instead of the hosted one.

## 6. Guardrails (protect you and them)

- They hold **all their own keys** (Supabase, GHL, Vercel). You hold none of theirs.
- The bundle has **zero** references to your NAS / mesh / brain (sever-checked at build).
- Brain stays off until licensed — no free backend.
- Data isolation via RLS; their customer data is theirs alone.

---

_See also: `docs/PROJECTAIXMOS-LEGACY-SPLIT.md` (the split spec),
`docs/DEPLOY.md`, `docs/GHL-PIPELINE-SETUP.md`, `docs/DATABASE-SCHEMA.md`._
