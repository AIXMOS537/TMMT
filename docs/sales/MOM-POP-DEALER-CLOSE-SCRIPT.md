# Mom & Pop Dealership — Close Script (Ops Kit $997 + $297/mo)

**Use for:** Independent used-car lots · BHPH · single-location floor · fleet desk  
**Demo URL:** https://tmmt-ops.vercel.app/kits  
**Form sample:** https://tmmt-ops.vercel.app/forms/lead-intake  
**Full 1-pager:** [`DEALER-KIT-ONE-PAGER.md`](./DEALER-KIT-ONE-PAGER.md)

---

## 30-second opener

> "You run your lot. We give you your **own** system — your customers, your leads, your data. Not a shared login where another dealer might see your books. Setup is under a grand, about three hundred a month, and we train your team in two weeks."

---

## What they buy (Ops Kit — start here for mom & pop)

| | |
|---|---|
| **Setup** | $997 one-time |
| **Monthly** | $297/location |
| **Gets** | Lead intake forms · fleet/customer desk · staff logins · GHL pipeline sync |
| **Upgrade path** | Dealer Bundle ($3,497 + $697/mo) adds Command Center for owner |

**Do NOT pitch credit repair** until L1–L10 legal gates clear. Ops-only is clean.

---

## Demo flow (5 minutes)

1. Open `/forms/lead-intake` — "This is what your website or QR code sends you."
2. Open `/kits` — "This is how you pay and get onboarded."
3. Show staff login on **their** instance after provision — not shared Command Center.

---

## Close

1. Send GHL checkout: Ops Kit setup + $297/mo subscription
2. Tag: `dealer-prospect` → `kit-ordered-ops` → `kit-shipped`
3. Run: `node scripts/provision-dealer-instance.mjs --dealer "Joe's Auto" --email owner@joesauto.com --dry-run`
4. After `--apply`: hand off `OPERATOR-START-HERE.md` + admin login

---

## Objections

| They say | You say |
|----------|---------|
| "Can't we use your login?" | "Not for independents — your customer list stays in **your** house." |
| "We already have a DMS." | "We sit **on top** — intake, follow-up, fleet desk. Keeps working if you switch DMS later." |
| "Too expensive." | "One extra car deal pays for the year. You lose more from missed follow-ups." |
| "Need credit repair too." | "Growth Kit stacks later — ops first so you're cash-flow positive." |

---

## Internal — provision checklist

See `scripts/provision-dealer-instance.mjs` and `docs/sales/DEALER-10-10-YTD-AUDIT.md`.
