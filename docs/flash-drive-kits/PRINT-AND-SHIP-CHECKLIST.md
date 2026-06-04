# Print & ship checklist

Use for **every** USB order. Check boxes before sealing envelope.

## Before building the USB

- [ ] Payment confirmed in GHL (tag `kit-ordered-*`)
- [ ] SKU matches buyer type (dealer vs public)
- [ ] Run `bash scripts/build-retail-usb.sh <ops|command|growth> /Volumes/<USB>`
- [ ] Spot-check: `START_HERE.command` (Mac) or `START_HERE.bat` (Win) opens
- [ ] No `.env` or secrets on drive (`grep -r "sk_" /Volumes/<USB>` → empty)

## Print (letter paper)

- [ ] `ENVELOPE-COVER.html` — kit name + kit ID handwritten
- [ ] Kit `PRINT-QUICK-START.html` for that SKU
- [ ] `ORDER-FORM.html` if including upsell (Dealer Bundle on Ops-only orders)
- [ ] Growth kit only: `COMPLIANCE-ONE-PAGER.html`

## Pack

- [ ] USB in anti-static bag or sleeve
- [ ] Printed quick start **on top** of USB (visible when envelope opened)
- [ ] Business card or support line sticker
- [ ] Seal #10 or 6×9 envelope

## After ship

- [ ] GHL tag `kit-shipped` + tracking number on contact
- [ ] Supabase: create login(s) if dealer Ops/Command (owner sends invite)
- [ ] Log kit ID → contact ID in spreadsheet
- [ ] Follow up day 3: “Did START_HERE work?”

## Dealer bundle (2 USBs)

- [ ] Ops kit + Command kit, same kit ID prefix (e.g. `DLR-2026-014-A`, `-B`)
- [ ] One invoice in GHL for DLR-BND
