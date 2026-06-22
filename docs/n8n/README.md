# n8n Automation Flows — AIXMOS/TMMT

> n8n runs always-on on **BRAINIAC** (Windows home PC, `100.x.x.x` Tailscale IP).
> These are the canonical flow specs. Actual flow JSON files live inside n8n on BRAINIAC.
> To export: n8n UI → Workflows → Export → save to this folder as `<slug>.json`.
>
> Operating rules for these flows: `AIXMOS_OPERATING_LAYER.md §4` (intake gate) and `§9` (n8n flows).
> Full automation logic: `AIXMOS-COMMAND/MOE-LEGACY/06-ASCENSION-AUTOMATIONS.md`

---

## BRAINIAC Access

```bash
# Via Tailscale (from any tailnet device)
ssh taha@<brainiac-tailscale-ip>

# n8n UI
http://<brainiac-tailscale-ip>:5678

# Ollama (local inference)
http://<brainiac-tailscale-ip>:11434
```

See `AIXMOS-COMMAND/REMOTE-BRAINIAC.md` for full access runbook.

---

## Flow Registry

### FLOW-01 — Intake Classifier
**Trigger:** GHL webhook on any contact stage change or tag addition.
**What it does:**
1. Receives the GHL payload.
2. Strips PII, builds a classification prompt.
3. Calls Ollama (`llama3.2:3b` default, zero cloud cost).
4. Labels the contact: `TMMT_LEAD | AIXMOS_LEAD | CREDIT_FUNDING | PAYMENT | RENEWAL | OPERATOR | LEGAL_FLAG | CONTENT | UNKNOWN`.
5. Routes per the matrix in `AIXMOS_OPERATING_LAYER.md §4.2`.

**Fail-closed:** if Ollama is unreachable → label `UNKNOWN` → route to Justin/Dominique default.
**Cloud fallback:** Claude Haiku 4.5 only if Ollama returns error after 3s. Debit 1 TMMT token from the flow's operator account.

---

### FLOW-02 — A1: TMMT → Moe Legacy Referral
**Trigger:** `needs-credit` tag added to a TMMT GHL contact.
**Guard:** `consent-captured` tag must be present. If missing → HALT, create ClickUp task to collect consent, no PII sent.
**What it does:**
1. Fires `referral.tmmt_to_moe` webhook → Moe's GHL affiliate intake link.
2. Moe's system creates the contact (we do NOT create it).
3. Writes `partner_referrals` row: `source=tmmt, dest=moe_legacy, reason=credit_repair, status=pending`.
4. Creates ClickUp task (venture `moe_legacy`) → Moe POC.
5. Tags contact `referred-from-tmmt` in our system.

---

### FLOW-03 — A2: AIXMOS → Moe Legacy Referral
**Trigger:** contact reaches `funding-prep` stage in AIXMOS GHL location.
**Guard:** `consent-captured` required. Fail-closed.
**What it does:** same as FLOW-02 but fires `referral.aixmos_to_moe`, `reason=credit_repair|funding`.

---

### FLOW-04 — A4: Moe Legacy → TMMT Vehicle Referral
**Trigger:** Moe fires a status webhook when a client reaches `Funded`/`Approved`.
**Guard:** `consent-captured` for a vehicle referral. Fail-closed.
**What it does:**
1. Creates a new lead in TMMT rental pipeline.
2. Tags `referred-from-moe`, sets `referral_source_org=moe`.
3. Writes `partner_referrals` row.
4. Notifies Dominique (TMMT fleet).
5. Creates ClickUp task (venture `tmmt`).

---

### FLOW-05 — A5: Lease-Qualified Check
**Trigger:** daily cron (or on payment recorded in Supabase `rental_ledger`).
**What it does:**
1. Queries Supabase `rental_ledger` / `customer_payments` for consecutive on-time payments ≥ **12 weeks** (3 months of proof; protects against early LTO defaults).
2. If threshold met and no active delinquency → tags `lease-qualified` in GHL.
3. Moves contact into TMMT LTO pipeline.
4. Creates `lto_agreements` draft.
5. Assigns task to Bibbs.

---

### FLOW-06 — A6: Operator Track
**Trigger:** `operator-track` tag added (set when lessee/funded client wants to scale to a fleet).
**Guard:** `consent-captured` + has LLC + funding or asset. Fail-closed.
**What it does:**
1. Fires `referral.tmmt_to_aixmos` → AIXMOS systems pipeline.
2. Presents operator ladder: Rental-in-a-Box $15K → Agents of Chaos $50K.
3. Writes `partner_referrals` row.
4. On close: provisions tenant — `organizations` row + `operator_profiles` (level `candidate`) + `organization_licenses` + split tier.

---

### FLOW-07 — Commission Ledger Writer
**Trigger:** called by any flow that completes a successful cross-entity referral.
**What it does:**
1. Writes the `partner_referrals` row with idempotency key `(source, dest, contact_id, reason)`.
2. On close/payment confirmed: calculates commission per `operator_commission_schedule.md`.
3. Creates ClickUp payment task for owner review before any payout.

**Owner-approval gate:** no commission payment executes without explicit owner approval.

---

## Export / Restore

To back up flows from BRAINIAC to this repo:
```bash
# On BRAINIAC
cd /path/to/n8n-data
n8n export:workflow --all --output=~/n8n-export/
# Then rsync to this folder via Tailscale
rsync -avz taha@<brainiac-ip>:~/n8n-export/ ~/projects/TMMT/docs/n8n/flows/
```

Flow JSON files (when exported) go in `docs/n8n/flows/` — do NOT commit credentials or webhook secrets. Use placeholder values in exported JSONs.
