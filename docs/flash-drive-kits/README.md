# Flash drive kits — print & ship

**Master guide:** [`../FLASH-DRIVE-PRODUCT-LINE.md`](../FLASH-DRIVE-PRODUCT-LINE.md)

## Print today (Chrome)

1. Open each HTML file → **File → Print → Save as PDF**
2. [`ORDER-FORM.html`](ORDER-FORM.html) — add GHL QR codes before printing
3. [`ENVELOPE-COVER.html`](ENVELOPE-COVER.html) — write kit name + SKU
4. Per kit: `01-tmmt-ops-kit/PRINT-QUICK-START.html`, etc.

## Build USB

```bash
bash ../../scripts/build-retail-usb.sh ops     /Volumes/YOURUSB
bash ../../scripts/build-retail-usb.sh command /Volumes/YOURUSB2
bash ../../scripts/build-retail-usb.sh growth  /Volumes/YOURUSB3
```

## Collect payment

**USB:** QR on [`ORDER-FORM.html`](ORDER-FORM.html)  
**Online:** Host [`BUY-ONLINE.html`](BUY-ONLINE.html) on GHL or link from AIXMOS landing  

Full guide: [`../SALES-CHANNELS.md`](../SALES-CHANNELS.md)

1. Connect Stripe in GHL → create 8 products (setup + monthly per SKU)
2. Paste checkout URLs into `GHL-CHECKOUT.env.example` + BUY-ONLINE.html script
3. Tag buyers in GHL when paid → ship USB **or** send digital email
4. Webhook → TMMT `/api/webhooks/ghl` for Supabase payment log
