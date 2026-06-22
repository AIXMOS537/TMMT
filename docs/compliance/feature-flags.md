# Feature Flag Registry — Compliance-Gated Features

> **These flags are locked. Do not enable, default-on, remove, or route around them.**
> Canonical rule: `AIXMOS_OPERATING_LAYER.md §8`
> Any change to a flag's state requires the listed flag owner to provide explicit written approval.

---

## Flag Table

| Flag | State | Flag Owner | Legal Prerequisite | What it gates |
|------|-------|------------|-------------------|---------------|
| `CREDIT_MODULE` | **LOCKED** | Muhammad Taha or Umar (both must agree) | CROA full compliance + VA Credit Services Businesses Act + written client disclosures + mandatory cancellation window wired into product | Full credit-repair feature set: dispute engine, tradeline tracker, credit-bureau submission |
| `FUNDING_MODULE` | **LOCKED** | Muhammad Taha or Umar | Lending/broker license review complete; no advance fee structure; all CFPB disclosures in place | Business funding origination: applications, broker routing, funding desk |
| `EQUITY_INSTRUMENT` | **LOCKED** | Muhammad Taha only | Reg D / Howey analysis by securities counsel; §83(b) election within 30 days of grant for any profits-interest | Profit-share or equity instruments bundled into any product offer |
| `SCREEN_MONITOR` | **LOCKED** | Muhammad Taha only | Signed per-person consent form on file + written monitoring policy disclosed to monitored party | Discovery Agent screen capture / session recording on any operator or employee device |
| `PARTNER_LICENSE_REVOKE` | **LOCKED** | Muhammad Taha only | Written notice per partner agreement terms before activation | Kill-switch activation on any partner/white-label tenant |
| `FULL_RESELLER_KIT` | **LOCKED** | Muhammad Taha only | Master Partner Agreement signed by both parties + counsel-cleared (not just drafted) | Full engine source delivery to any partner (e.g. Moe Legacy reseller kit) |

---

## What "Routing Inquiries" Means (Allowed)

An agent or automation may:
- Describe what credit repair or funding is, in compliant language ("we help you build a plan").
- Collect consent to refer a customer to Moe Legacy.
- Fire the referral webhook to Moe Legacy after consent is captured.
- Log the `partner_referrals` row.

An agent or automation may NOT:
- Collect fees for credit repair.
- Submit any dispute or credit-bureau contact on a customer's behalf.
- Originate or broker a funding application.
- Claim a guaranteed outcome.

---

## How to Unlock a Flag (process)

1. Flag owner (listed above) provides written approval in the format: `"I approve unlocking [FLAG_NAME] on [date] for [specific scope]."` — in Slack DM to the owner account, or in a signed document in `~/Documents/Business/legal/`.
2. The legal prerequisite must be verifiably met (license issued, counsel letter on file, disclosures wired into product and tested).
3. Owner or authorized developer updates the flag in Supabase `feature_flags` table OR the relevant env var.
4. Change is committed with a note referencing the approval date and document.

No agent, automation, or developer may self-approve a flag unlock.

---

## Umar Note

Per owner directive (2026-06-18): Muhammad Umar is co-listed on `CREDIT_MODULE` and `FUNDING_MODULE` only. He has no unlock authority over any other flag. He has no access to admin keys, engine source, or operator data. Any request from Umar to touch other flags routes to the owner for explicit confirmation before any action.
