# Tonight — Onboarding Go-Live Checklist

**Goal:** First operators can learn, earn, and operate **tonight** — safely.

Work top to bottom. ✅ = done this session where noted.

---

## Phase A — Owner machine (30 min)

| # | Action | Status |
|---|--------|--------|
| A1 | Quarantine Downloads secrets → `~/.aixmos/SECURITY-QUARANTINE` | ✅ Run: `bash scripts/quarantine-downloads.sh` |
| A2 | **Rotate** anything that lived in Downloads or chat (GHL password, ClickUp `pk_`, GHL `pit-`) | 🔴 **You** — Dashlane + provider dashboards |
| A3 | Rotate password from quarantined `TMMT_OWNER_PASSWORD=*.png` | 🔴 **You** |
| A4 | Device integrity scan | ✅ Run: `bash scripts/device-integrity.sh` |
| A5 | Enable **FileVault** + **Find My** on this Mac | 🔴 System Settings |
| A6 | Supabase Auth → enable **Leaked password protection** | 🔴 Dashboard toggle |

---

## Phase B — Database (done if migration applied)

| # | Action | Status |
|---|--------|--------|
| B1 | Anon blocked from `tmmt_token_grant` / `tmmt_token_spend` | ✅ Migration `tonight_security_hardening` |
| B2 | Full multi-tenant staff blast-radius | 🟡 Tracked — see `docs/SECURITY-LAYER-3-RLS-FINDINGS.md` |
| B3 | Old `harden_tenant_isolation.sql` in Downloads | ⚠️ **Superseded** — do not apply; prod uses `org_id` + newer migrations |

---

## Phase C — Wire the brain (5 min)

| # | Action | Status |
|---|--------|--------|
| C1 | Operator terminology | ✅ `docs/OPERATOR-BRAIN.md` |
| C2 | AI assistant rules | ✅ `docs/OPERATOR-AGENT-RULES.md` |
| C3 | Owner session memory | ✅ `docs/BUILD_MEMORY.md` |
| C4 | Cursor: open TMMT repo — rules load from `.cursor/rules/` | ✅ |

**Tell any AI session:** *"Load OPERATOR-BRAIN.md and OPERATOR-AGENT-RULES.md first."*

---

## Phase D — Onboard first operator (45 min)

### D1 — Provision account
```bash
cd ~/Projects/TMMT
node scripts/provision-operators.mjs --email OPERATOR@EMAIL.com --role operator --dry-run
# remove --dry-run when correct
```

### D2 — Send them these 3 links
1. Login: https://tmmt-command-center.vercel.app/login  
2. Sell pages: https://tmmt-ops.vercel.app/kits · https://tmmt-ops.vercel.app/build  
3. Intake: https://tmmt-ops.vercel.app/forms/lead-intake  

### D3 — Send them one doc
`docs/OPERATOR-BRAIN.md` (export PDF or link to training portal when live)

### D4 — Rung 0 portal (no live data yet)
- They get playbook mode until you issue a scoped portal token.
- Moe template: `moe-legacy-portal` pattern — no service keys in client.

### D5 — Advance rung when earned
```bash
export ADMIN_KEY='…'   # from Dashlane — never chat
bash path/to/booyah-unlock.sh booyah          # +1 rung
bash path/to/booyah-unlock.sh booyah revoke    # emergency
```

---

## Phase E — Ads / traffic (when A + D done)

| Channel | First action |
|---------|--------------|
| **Lead intake URL** | https://tmmt-ops.vercel.app/forms/lead-intake |
| **Operator recruit** | GHL funnel → `recruit.html` / operator apply |
| **Compliance** | All copy through `node scripts/compliance-check.mjs` on consumer-facing content |
| **Support promise** | Office hours + portal — not "$15K then ghost" |

---

## Phase F — Mesh (each new machine)

```bash
bash scripts/quarantine-downloads.sh
bash scripts/device-integrity.sh
bash scripts/aixmos.sh doctor
```

**Never** run owner hub SSH setup (`AIXMOS-M5-SETUP.command`) on operator TRAPTOPs.

---

## One-command owner prep

```bash
bash scripts/tonight-go-live.sh
```

---

## Go / no-go for ads tonight

| Gate | Required |
|------|----------|
| Downloads quarantined | ✅ |
| Leaked creds rotated | 🔴 Owner |
| First operator provisioned | 🔴 Owner |
| Compliance copy checked | Before paid ads |
| Supabase anon token RPC closed | ✅ |

**Soft launch OK** (friends/family/operators you trust) once **A1–A4, C, D1–D3** are done.  
**Paid ads** wait until **A2, A5, A6, D4** and compliance check pass.

---

## What we built for you (not another guru repo)

- Linear **rungs** instead of paywall renewals  
- **Scoped tokens** instead of shared brain dumps  
- **Draft-don't-blast** instead of spam automation  
- **Real docs** operators can read in 10 minutes  
- **Kill-switch** owner keeps — operators keep dignity and data isolation  

*For the people. By the people.*
