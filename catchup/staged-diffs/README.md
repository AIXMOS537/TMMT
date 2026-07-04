# Staged diffs — review, then apply if you approve

These are **proposed** changes captured as patches. They are **NOT applied** to the
working tree or committed to any tracked source file. Nothing here is merged. Review
each, and if you approve, apply with `git apply <patch>` from the repo root.

---

## 01-ghl-cta-fallback.patch  ·  `AIXMOS/public/ghl-config.js`

**What it does:** makes the funnel CTAs degrade gracefully *before* real GHL checkout
links are pasted in. Today, while `AIXMOS_GHL` still holds `YOUR_GHL_*` placeholders,
the `[data-ghl-href]` buttons keep `href="#"` (a dead click that jumps to the top of
the page) and the `[data-ghl-card]` cards do nothing. This patch routes those
placeholder CTAs to `apply.html` (the intake form) so a click still **captures the
lead** instead of dead-ending. The moment a real `https://…` checkout URL is present
in `ghl-config.js`, the live URL wins and this fallback is never used.

**Why it's staged, not auto-applied:** it changes user-facing click behavior (a product
decision), so per the catch-up ground rules it's yours to approve.

**Apply:**
```bash
git apply catchup/staged-diffs/01-ghl-cta-fallback.patch
```

**IMPORTANT — the real fix is still yours to do (money / live surface, not auto-applied):**
The four pages are already fully wired at the code level. What actually turns the
buttons into working checkouts is pasting your real GoHighLevel links into
`AIXMOS/public/ghl-config.js` (or setting the `NEXT_PUBLIC_GHL_*` vars and letting the
prebuild generate the deployed copy):

| Config key | Replace `YOUR_GHL_*` with |
|---|---|
| `checkout97` | $97/mo subscription checkout URL |
| `checkoutLLC` | $397 LLC formation checkout URL |
| `checkout3750` | $3,750 base-build down-payment checkout URL |
| `operatorApply` | operator application form URL |
| `webhookUrl` | GHL webhook URL for form submissions |
| `formId` | GHL native form ID (embed) |

This step touches money collection and a live surface, so it's left for you — not
applied here.
