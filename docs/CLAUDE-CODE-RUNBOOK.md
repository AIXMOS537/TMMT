# Claude Code — TMMT Revenue Fast-Track Runbook

**Repo:** `~/Projects/TMMT` · GitHub `AIXMOS537/TMMT` · **Branch: `master` only**  
**Launcher:** `bash scripts/claude-fasttrack.sh`  
**Do not merge:** `feature/rescue-dispatch-core` (Phase 6)

---

## START HERE

One command to paste in your terminal (starts Claude Code with the mission):

```bash
cd ~/Projects/TMMT && claude "$(bash scripts/claude-fasttrack.sh --instruction)"
```

Copy the full runbook into clipboard:

```bash
bash scripts/claude-fasttrack.sh --prompt | pbcopy
```

---

## Master prompt (copy-paste if not using CLI wrapper)

```
You are executing the TMMT revenue fast-track on branch master in ~/Projects/TMMT.

Follow docs/CLAUDE-CODE-RUNBOOK.md phases 1–6 in order. Work autonomously except at GHL login gates.

Existing work to verify and build on:
- src/app/kits/page.tsx — kit landing page
- src/lib/kit-checkout.ts — GHL checkout env vars
- middleware.ts — /kits is public (no auth)
- docs/SALES-CHANNELS.md — product catalog + GHL setup
- scripts/smoke-prod.sh, scripts/retire-vercel-duplicates.sh, scripts/build-retail-usb.sh

Hard rules:
1. Stay on master. Never merge feature/rescue-dispatch-core.
2. npm run build must pass before git push.
3. STOP and ask user at Phase 2 GHL gates (Stripe connect, checkout URLs).
4. Only commit when phase verification passes (unless user says skip commit).
5. Report after each phase: checkboxes, command output, curl status codes.
```

---

## Pre-flight (all phases)

```bash
cd ~/Projects/TMMT
git checkout master
git pull origin master
git status
npm run build
```

| If build fails | Check |
|----------------|-------|
| TypeScript error in `kits/` | Fix imports in `src/app/kits/page.tsx`, `src/lib/kit-checkout.ts` |
| Missing env at build | Supabase vars in `.env` — see `.env.example` |
| Middleware error | `middleware.ts` — `/kits` in `isPublicPath()` |
| Unrelated branch changes | `git stash` or discard; do not merge rescue-dispatch |

---

## Phase 1 — Commit & deploy `/kits` landing

**Goal:** Ship the kit sales page so checkout buttons can go live after Phase 2.

### Checklist

- [ ] `src/app/kits/page.tsx` exists and renders three kits + dealer bundle
- [ ] `src/lib/kit-checkout.ts` reads `NEXT_PUBLIC_GHL_*` env vars
- [ ] `middleware.ts` includes `pathname === "/kits"` in `isPublicPath`
- [ ] `npm run build` passes locally
- [ ] Changes committed (only if user approved commit)
- [ ] Pushed to `master` → Vercel auto-deploys project **`tmmt-c919`**

### Commands

```bash
cd ~/Projects/TMMT
npm run build

# Review what will ship
git status
git diff
git diff --stat master

# Commit (only when user asks)
git add src/app/kits/ src/lib/kit-checkout.ts middleware.ts
git commit -m "$(cat <<'EOF'
Add public /kits landing page for GHL checkout links.

EOF
)"
git push origin master
```

### Verification (after deploy — wait ~2 min)

```bash
# Primary operator URL (canonical Vercel alias)
curl -sS -o /dev/null -w "kits: %{http_code}\n" https://tmmt-command-center.vercel.app/kits

# Local smoke (optional)
npm run dev &
sleep 5
curl -sS -o /dev/null -w "local kits: %{http_code}\n" http://localhost:3000/kits
```

| Expected | Meaning |
|----------|---------|
| `kits: 200` | Landing live |
| `kits: 307/308` | Redirect — check middleware auth redirect loop |
| `kits: 404` | Deploy stale or wrong Vercel project — see Phase 5 |

**Note:** Checkout buttons anchor to `#checkout-pending` until Phase 2 env vars are set — that is expected pre-GHL.

---

## Phase 2 — GHL + Stripe (unblocks sales)

**Goal:** Connect Stripe in GoHighLevel, create products, paste checkout URLs into Vercel.

### ⛔ STOP — ask user

Claude **cannot** log into GoHighLevel. Pause and ask the user to:

1. Log into GHL → **Settings → Payments → Integrations → Stripe** → Connect (test mode first)
2. Create **8 products** per [`docs/SALES-CHANNELS.md`](SALES-CHANNELS.md) (4 setup + 4 monthly)
3. Create checkout pages / payment links for each SKU
4. Copy each hosted checkout URL for the env vars below

Resume when user provides checkout URLs or confirms they are in Vercel.

### Env vars (Vercel Production + local `.env`)

| Variable | SKU / purpose |
|----------|---------------|
| `NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT` | TMMT Ops setup ($997) |
| `NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT_USB` | Ops + ship USB |
| `NEXT_PUBLIC_GHL_CHECKOUT_OPS_MONTHLY` | Ops $297/mo |
| `NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_KIT` | Command setup ($2,997) |
| `NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_KIT_USB` | Command + ship USB |
| `NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_MONTHLY` | Command $497/mo |
| `NEXT_PUBLIC_GHL_CHECKOUT_97` | AIXMOS Growth / membership ($97) |
| `NEXT_PUBLIC_GHL_CHECKOUT_DEALER_BUNDLE` | Dealer bundle setup ($3,497) |
| `NEXT_PUBLIC_GHL_CHECKOUT_DEALER_MONTHLY` | Dealer bundle $697/mo |
| `NEXT_PUBLIC_GHL_OPERATOR_APPLY` | Operator apply funnel |
| `NEXT_PUBLIC_SUPPORT_PHONE` | Printed on `/kits` footer |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Printed on `/kits` footer |
| `GHL_WEBHOOK_SECRET` | Server webhook auth (Phase 3) |

Template: [`docs/flash-drive-kits/GHL-CHECKOUT.env.example`](flash-drive-kits/GHL-CHECKOUT.env.example)

### Set Vercel env (CLI or dashboard)

```bash
cd ~/Projects/TMMT
# Dashboard: Vercel → project tmmt-c919 → Settings → Environment Variables → Production
# Or CLI (example — replace values):
# vercel env add NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT production
```

After env changes, **redeploy** (push empty commit or Vercel → Redeploy).

### Commands

```bash
cd ~/Projects/TMMT
npm run check-env          # Supabase reachability
npm run check-env:revenue  # Revenue-related vars
npm run ghl:check          # P0 GHL vars audit
```

### Decision gates — `npm run ghl:check` fails

| Symptom | Fix |
|---------|-----|
| `GHL_WEBHOOK_SECRET` empty | Generate random secret → Vercel + `.env` → redeploy |
| `NEXT_PUBLIC_GHL_CHECKOUT_97` placeholder | Paste real GHL checkout URL from Payments → Links |
| `NEXT_PUBLIC_GHL_UPSELL_PIPELINE_URL` placeholder | GHL pipeline filter URL or valid pipeline deep link |
| `NEXT_PUBLIC_OWNER_HUB_HOST` empty | Set to `tmmtrentals.net` in Vercel |
| P0 pass but kit buttons still `#checkout-pending` | Kit-specific `NEXT_PUBLIC_GHL_CHECKOUT_*` not set — add from Phase 2 table |

### Verification

```bash
npm run ghl:check
# Expect: "P0 env vars look configured."

# After redeploy with kit URLs — spot-check HTML contains real hrefs (not #checkout-pending)
curl -sS https://tmmt-command-center.vercel.app/kits | grep -o 'href="[^"]*checkout[^"]*"' | head -5
```

---

## Phase 3 — Wire fulfillment (webhooks, tags, workflows)

**Goal:** GHL tags + workflows POST to TMMT; payments log in Supabase.

### GHL tags to create

`kit-ordered-ops`, `kit-ordered-command`, `kit-ordered-growth`, `kit-ordered-dealer-bundle`, `kit-ship-physical`, `kit-digital-only`, `member-97`, `tmmt-customer`, `ready-for-aixmos`

See [`docs/SALES-CHANNELS.md`](SALES-CHANNELS.md) §5 and [`docs/GHL-WEBHOOK-SETUP.md`](GHL-WEBHOOK-SETUP.md).

### GHL workflow (after payment)

**Trigger:** Order submitted / Payment received  
**Action:** Custom webhook

```
POST https://tmmt-command-center.vercel.app/api/webhooks/ghl
Header: x-ghl-webhook-secret: <GHL_WEBHOOK_SECRET>
Content-Type: application/json
```

Body example:

```json
{
  "email": "{{contact.email}}",
  "event": "payment_received",
  "amount": {{order.total}},
  "product": "{{product.name}}",
  "tags": ["kit-ordered-ops", "member-97"]
}
```

### ⛔ STOP — ask user

Confirm `GHL_WEBHOOK_SECRET` in Vercel matches the header configured in GHL workflow.

### Commands

```bash
cd ~/Projects/TMMT

# Local (dev server must be running for localhost tests)
npm run dev &
sleep 5
GHL_TEST_BASE_URL=http://localhost:3000 npm run ghl:test-webhook tag
GHL_TEST_BASE_URL=http://localhost:3000 npm run ghl:test-webhook program
GHL_TEST_BASE_URL=http://localhost:3000 npm run ghl:test-webhook payment

# Production webhook smoke
GHL_TEST_BASE_URL=https://tmmt-command-center.vercel.app npm run ghl:test-webhook payment
```

### Decision gates

| Symptom | Fix |
|---------|-----|
| HTTP 401 | `GHL_WEBHOOK_SECRET` mismatch between GHL header and Vercel |
| HTTP 404 | Wrong URL or stale deploy |
| `{ ok: true, skipped: "no matching contact" }` | Normal for test email — use real customer email in `GHL_TEST_EMAIL` |
| Payment not in Supabase | Check `SUPABASE_SERVICE_ROLE_KEY` on Vercel; inspect `/api/webhooks/ghl` logs |

### Verification

```bash
npm run ghl:check -- --test-webhook   # if dev server running
curl -sS -X POST https://tmmt-command-center.vercel.app/api/webhooks/ghl \
  -H "Content-Type: application/json" \
  -H "x-ghl-webhook-secret: $GHL_WEBHOOK_SECRET" \
  -d '{"email":"test@example.com","event":"payment_received","amount":97,"tags":["member-97"]}'
```

Run a **$1 test product** in GHL test mode before going live.

---

## Phase 4 — Physical channel (print + USB)

**Goal:** Printed order forms with QR codes; retail USBs ready to ship.

### Print (Chrome → Save as PDF)

| File | Purpose |
|------|---------|
| `docs/flash-drive-kits/ORDER-FORM.html` | QR per SKU (create if missing — copy from BUY-ONLINE.html pattern) |
| `docs/flash-drive-kits/ENVELOPE-COVER.html` | Envelope label |
| `docs/flash-drive-kits/BUY-ONLINE.html` | Online store reference / GHL embed |
| `docs/flash-drive-kits/01-tmmt-ops-kit/PRINT-QUICK-START.html` | Per-kit insert (when folders exist) |

Paste GHL checkout URLs into HTML before printing (same vars as Phase 2).

### Build USB

```bash
cd ~/Projects/TMMT
# Plug in USB — confirm mount point
ls /Volumes/

bash scripts/build-retail-usb.sh ops     /Volumes/TMMT-OPS
bash scripts/build-retail-usb.sh command /Volumes/TMMT-CMD
bash scripts/build-retail-usb.sh growth  /Volumes/AIXMOS-GROWTH
```

### Decision gates — USB build fails

| Symptom | Fix |
|---------|-----|
| `Volume not found` | Re-plug USB; use correct `/Volumes/NAME` |
| `Kit source folder missing` | Populate `docs/flash-drive-kits/01-tmmt-ops-kit/` etc. per [`docs/FLASH-DRIVE-PRODUCT-LINE.md`](FLASH-DRIVE-PRODUCT-LINE.md), or use `aixmos-kit` repo `build-master-usb.sh` |
| Permission denied | USB may be read-only — reformat FAT32/exFAT |

### Verification

- [ ] ORDER-FORM QR scans to live GHL checkout (phone test)
- [ ] USB `kit-id.txt` written; drive opens START_HERE / quick-start HTML
- [ ] No `.env` or secrets on USB

---

## Phase 5 — Production cleanup

**Goal:** Fix stale prod deploy, retire duplicate Vercel projects, DNS ready.

### 5a — Fix `/forms/customer-intake` 404

**Root cause:** Production deploy older than the page (known issue — see `docs/operator-team/OPERATOR_MANUAL.md` §9).

```bash
cd ~/Projects/TMMT
npm run build
git push origin master   # triggers fresh deploy on tmmt-c919

# Wait for deploy, then:
curl -sS -o /dev/null -w "customer-intake: %{http_code}\n" \
  https://tmmt-command-center.vercel.app/forms/customer-intake
```

Expected: `customer-intake: 200`

### 5b — Full production smoke

```bash
cd ~/Projects/TMMT
npm run smoke:prod

# Or with custom base:
SMOKE_BASE_URL=https://tmmt-command-center.vercel.app bash scripts/smoke-prod.sh
```

Add `/kits` to manual check (smoke script may not include it yet):

```bash
curl -sS -o /dev/null -w "kits: %{http_code}\n" https://tmmt-command-center.vercel.app/kits
```

### 5c — Retire duplicate Vercel projects

**Keep:** `tmmt-c919` (`prj_moZzMHYtwiZIS0TETOBOKODbp7eM`)  
**Remove:** `tmmt`, `tmmt-ops`, `aixmos-landing`, old `tmmt-command-center` shell

```bash
cd ~/Projects/TMMT
bash scripts/retire-vercel-duplicates.sh          # dry-run checklist
bash scripts/retire-vercel-duplicates.sh --apply  # deletes safe duplicates (needs vercel login)
```

### ⛔ STOP — ask user

Before `--apply`: confirm Vercel dashboard rename `tmmt-c919` → `tmmt-command-center` (Settings → General) so `tmmt-command-center.vercel.app` points at the canonical deploy.

### 5d — DNS (when ready)

| Domain | Target |
|--------|--------|
| `tmmtrentals.net` | Vercel project `tmmt-c919` (staff hub) |
| `tmmtrentals.com` / marketing | GHL sites (not Vercel TMMT root) |

```bash
curl -sS -o /dev/null -w "net login: %{http_code}\n" https://tmmtrentals.net/login
curl -sS -o /dev/null -w "kits (if routed): %{http_code}\n" https://tmmtrentals.net/kits
```

---

## Phase 6 — Safety rail

### Checklist

- [ ] Current branch is `master`
- [ ] `feature/rescue-dispatch-core` is **not** merged, rebased, or deployed
- [ ] No rescue-dispatch routes enabled in production env

### Commands

```bash
cd ~/Projects/TMMT
git branch --show-current
git log --oneline -5
git branch -a | grep rescue-dispatch || true
```

If rescue-dispatch work is needed later, it is a **separate PR** after revenue path is live.

---

## Reference URLs

| Surface | URL |
|---------|-----|
| Kit landing (post-deploy) | `https://tmmt-command-center.vercel.app/kits` |
| Staff login | `https://tmmt-command-center.vercel.app/login` |
| GHL webhook | `https://tmmt-command-center.vercel.app/api/webhooks/ghl` |
| Vercel project | `tmmt-c919` → rename to `tmmt-command-center` |

---

## Related docs

- [`SALES-CHANNELS.md`](SALES-CHANNELS.md) — product catalog, GHL step-by-step
- [`GHL-WEBHOOK-SETUP.md`](GHL-WEBHOOK-SETUP.md) — webhook payload + testing
- [`FLASH-DRIVE-PRODUCT-LINE.md`](FLASH-DRIVE-PRODUCT-LINE.md) — SKUs, print pack, USB
- [`DEPLOY.md`](../DEPLOY.md) — Vercel project, routine deploy
- [`CLAUDE-CODE-FASTTRACK.md`](CLAUDE-CODE-FASTTRACK.md) — quick index

---

## After Claude Code finishes

1. Open `/kits` on live URL — confirm checkout links (not `#checkout-pending`)
2. Print ORDER-FORM QR codes from `docs/flash-drive-kits/`
3. Take first real payment in GHL **test mode**, then flip Stripe live
4. Run `npm run smoke:prod` one final time
