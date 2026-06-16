# EXECUTE NOW — the one ordered runbook (carry Mac, tonight)

> Everything built this session, in the order to run it. ☁️ = already done by the
> cloud session (committed). 💻 = you run on a machine. 🌐 = a dashboard. ⚖️ = you +
> counsel. Work top to bottom; each step names its guide.

_All code is on branch `claude/team-absence-notification-0rYgo` — local, no PR._

---

## Phase 0 — get on the carry Mac ☁️done → 💻
```bash
git clone https://github.com/AIXMOS537/TMMT.git && cd TMMT
git checkout claude/team-absence-notification-0rYgo
bash scripts/aixmos.sh doctor          # tells you what's missing on this box
```

## Phase 1 — bring the mesh up 💻🌐
1. 💻 **Carry Mac (CARRY / hub):** `bash scripts/setup-node.sh --apply --license AIXMOS-XXXX-XXXX-XXXX-XXXX --role carry`
2. 💻 Start the brain: run Ollama + `litellm --config litellm.config.yaml --port 4000` (edit tailnet IPs first). `export LITELLM_BASE=http://127.0.0.1:4000/v1`
3. 💻 **Brainiac PC (BRAIN):** `powershell -ExecutionPolicy Bypass -File scripts\setup-node.ps1 -Apply -License AIXMOS-... -Role brainiac`
4. 💻 **Work Mac (FORGE):** `bash scripts/setup-node.sh --apply --license AIXMOS-... --role work` → point `LITELLM_BASE` at carry's tailnet IP.
5. 🌐 Join all on **Tailscale**; apply `infra/tailscale-acl.jsonc` in the admin.
   _Guide: `docs/QUICKSTART.md`, `docs/LOCAL-FIRST-AI-STACK.md`, `docs/MESH-COORDINATION.md`._

## Phase 2 — turn on the safety nets 💻
```bash
bash scripts/aixmos.sh hooks           # pre-push fact-check gate
bash scripts/aixmos.sh verify --apply  # local model fixes anything red
node scripts/compliance-check.mjs content/consumer-facing   # credit/funding guardrail
```
_Guide: `docs/VERIFICATION-MESH.md`, `docs/CREDIT-FUNDING-COMPLIANCE.md`._

## Phase 3 — ship Moe Legacy's car-rental platform 💻🌐
1. 💻 Build the backend-less bundle: `bash scripts/build-projectaixmos-legacy.sh --apply --build --git`
2. 💻 `cd ../projectaixmos-legacy && cp .env.legacy.example .env` → fill THEIR keys.
3. 🌐 Their **Supabase** (run migrations, confirm RLS) · **GHL** (rental pipeline) · **Vercel** (deploy).
4. 💻🌐 Launch checklist: load fleet, forms live, test booking + checkout.
   _Guide: `docs/LEGACY-DEPLOY-MOE.md`. (AI brain stays OFF until licensed — §5.)_

## Phase 4 — onboard / discover (on Moe's machine, with consent) 💻
```bash
scripts/discover.sh                                            # shows consent notice
scripts/discover.sh --who "Moe Legacy" --scope ~/business --i-consent
open .aixmos/discovery/discovery-report.md                     # review together
# approve → emit integration handoff:
scripts/mesh-handoff.sh --from CLOUD --to FORGE --intent "Integrate approved systems" --slug moe-integrate
```
_Guide: `docs/CLIENT-ONBOARDING-DISCOVERY.md`. Integrate only what's approved._

## Phase 5 — clear the credit/funding pre-sale gate ⚖️ (cannot be automated)
Before charging anyone (`config/credit-compliance.json → pre_sale_gate`):
- [ ] ⚖️ Counsel-reviewed CROA contract + disclosures
- [ ] ⚖️ Fee structure with **no advance fees** for credit repair
- [ ] ⚖️🌐 State CSO registration + surety bond where required
- [ ] ⚖️ Funding licensing reviewed; no securities offering without compliance
- [ ] ⚖️ Consumer-PII privacy (GLBA/FCRA) reviewed
- [ ] ☁️done Banned-claims guardrail enforced on consumer output
_Guide: `docs/CREDIT-FUNDING-COMPLIANCE.md`._

## Your standing backstops (only these stay human)
1. Approve merge-to-`master` / production deploy.
2. Approve irreversible / outward actions (send, delete, rotate secrets, transfer).
3. Same-day offboarding + secret rotation.
4. Review a gate escalation.
5. Credit/funding compliance go/no-go (Phase 5).
_Detail: `docs/OPERATOR-RUNBOOK.md §2`._

---

## What the cloud session already finished ☁️ (16 commits, all pushed)
Legacy split + builder · flash-deploy runbook · mesh contract + handoff emitter ·
platform blueprint · device sync · offshore ACL + playbook · local-first AI stack
(June-2026 models) · verification mesh + gate · system index · operator runbook +
CLI · node installers + quickstart · Moe Legacy car-rental edition · consent
discovery · credit/funding compliance + guardrail · this runbook.

## What ONLY you can do (the honest boundary)
Run the machine-side setup (this container can't reach your Macs/PC), provision
Moe's Supabase/GHL/Vercel, run discovery on his box, and clear the legal pre-sale
gate with counsel. The cloud session built the brain; the nodes + you execute.

_Whole map: `docs/AIXMOS-SYSTEM-INDEX.md`._
