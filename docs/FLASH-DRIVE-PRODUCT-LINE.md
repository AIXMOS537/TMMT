# Flash Drive Product Line — Print, Ship, Sell

Three USB products aligned with the three apps in [`THREE-APP-ECOSYSTEM.md`](THREE-APP-ECOSYSTEM.md). Use this doc to **manufacture drives**, **print inserts**, and **collect payment**.

## Product SKUs

| SKU | Kit folder | Buyer | Setup (one-time) | Monthly |
|-----|------------|-------|------------------|---------|
| **OPS-001** | `flash-drive-kits/01-tmmt-ops-kit/` | Dealership / fleet floor | **$997** | **$297/mo** per location |
| **CMD-001** | `flash-drive-kits/02-tmmt-command-kit/` | Dealer owner / partner | **$2,997** | **$497/mo** |
| **GRW-001** | `flash-drive-kits/03-aixmos-growth-kit/` | Public (member / operator recruit) | **$97** (includes 1st month) | **$97/mo** membership |
| **DLR-BND** | Ops + Command kits | Full dealer stack | **$3,497** (save $497) | **$697/mo** |

*Adjust prices in GHL before printing [`ORDER-FORM.html`](flash-drive-kits/ORDER-FORM.html).*

## Sales channels (USB + online)

Same SKUs sell **two ways**: flash drive by mail **or** instant digital access after checkout.

Full setup: **[`SALES-CHANNELS.md`](SALES-CHANNELS.md)** — GHL + Stripe products, workflows, webhooks, [`BUY-ONLINE.html`](flash-drive-kits/BUY-ONLINE.html) store page.

## Payment collection (GoHighLevel + Stripe)

Create **one Stripe product per SKU** in GHL → paste checkout URLs into:

| Env var / placeholder | SKU |
|----------------------|-----|
| `NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT` | OPS-001 setup |
| `NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_KIT` | CMD-001 setup |
| `NEXT_PUBLIC_GHL_CHECKOUT_97` | GRW-001 (existing membership) |
| `NEXT_PUBLIC_GHL_CHECKOUT_DEALER_BUNDLE` | DLR-BND |

**Order flow:** Customer scans QR on [`ORDER-FORM.html`](flash-drive-kits/ORDER-FORM.html) → pays in GHL → tag `kit-ordered-<sku>` → you ship USB → tag `kit-shipped` → run provision script (Supabase user + welcome email).

**Tags to create in GHL:** `kit-ordered-ops`, `kit-ordered-command`, `kit-ordered-growth`, `kit-ordered-dealer-bundle`, `kit-shipped`, `dealer-prospect`, `operator-recruit`.

## Print pack (what to print for each shipment)

| Item | File | Copies |
|------|------|--------|
| Envelope cover | `flash-drive-kits/ENVELOPE-COVER.html` | 1 per USB |
| Kit quick start | `01-.../PRINT-QUICK-START.html` etc. | 1 per USB |
| Order / upsell card | `ORDER-FORM.html` | 1 (or leave out if already paid) |
| Compliance (Growth only) | `03-.../COMPLIANCE-ONE-PAGER.html` | 1 |

Print from Chrome → **Save as PDF** or print directly. Paper: letter, color optional for envelope cover.

## Ship checklist

See [`PRINT-AND-SHIP-CHECKLIST.md`](flash-drive-kits/PRINT-AND-SHIP-CHECKLIST.md).

## Build USB from master

```bash
# macOS — plug in blank USB (appears as /Volumes/YOURUSB)
cd ~/Projects/TMMT
bash scripts/build-retail-usb.sh ops    /Volumes/TMMT-OPS
bash scripts/build-retail-usb.sh command /Volumes/TMMT-CMD
bash scripts/build-retail-usb.sh growth  /Volumes/AIXMOS-GROWTH
```

Label each drive: **TMMT Ops Kit**, **TMMT Command Kit**, **AIXMOS Growth Kit**.

## Master copies (your three flash drives)

Keep one **gold master** of each kit. Clone with:

```bash
# Example: clone Ops master to retail drive
rsync -a --delete /Volumes/TMMT-OPS-MASTER/ /Volumes/RETAIL-COPY-1/
```

Write kit ID sticker: `OPS-2026-001` (log in spreadsheet or GHL contact note).

## Legal / compliance

- USB contains **no secrets** (no `.env`, no API keys).
- Growth kit: use **credit guidance** language only ([`03-aixmos-growth-kit/COMPLIANCE-ONE-PAGER.html`](flash-drive-kits/03-aixmos-growth-kit/COMPLIANCE-ONE-PAGER.html)).
- Include [`LICENSE.txt`](flash-drive-kits/LICENSE.txt) on every drive.

## Support

Buyer contacts: _(your support email / WhatsApp ops line)_  
Kit ID + SKU required for support. Revoke lost kits via `aixmos-kit` revoke flow when OPK ships.

## Related

- [`THREE-APP-ECOSYSTEM.md`](THREE-APP-ECOSYSTEM.md)
- [`AIXMOS-TMMT-FUNNEL.md`](AIXMOS-TMMT-FUNNEL.md)
- [`../aixmos-kit` README](https://github.com/AIXMOS537/aixmos-kit) — future unified OPK builder
