---
name: tmmt-ecosystem-framework
description: >-
  TMMT × AIXMOS operating model for this repo — VA executives, operator rubric,
  marketing rollout, offer ladder, partner apps. Use when changing team playbooks,
  operator journey, GHL sync, or positioning TMMT OS modules.
---

# TMMT Ecosystem Framework (tmmt-os)

Read **`docs/framework/OPERATING_MODEL.md`** first. PDF extracts: `~/Documents/cursor-pdfs/TMMT_*.extracted.md`.

## Repo mapping

| Framework module | TMMT OS surface |
|------------------|-----------------|
| Dashboard | `/client/*`, `/team/dashboard`, journey hub |
| Learn | `/client/training`, credit paths |
| Marketplace | Future / partner verticals |
| Operate | `/internal/cases`, fleet, ledger, GHL sync |
| Operator pipeline | `/internal/operators`, `operator_profiles`, rubric |
| VA executive SOPs | `/team/sops`, `/team/training`, `/team/sales` playbooks |
| Ops command | `/internal/assistant`, `POST /api/ops/command` |

## Operator rubric (`src/lib/client-journey/types.ts`)

7 categories / 100 points (PDF VA framework §07). Save via `/internal/operators`.

- **≥70:** `operator_candidate` entitlement + `program_track`
- **60–69:** GHL nurture only (`operator:candidate` tag)
- Levels: certified 70+, senior 75+, master 85+

## Related skills

- `tmmt-ops-command` — natural-language assign/approve/ledger
- Personal `pdf-documents` — re-extract source PDFs

## Partner / 50-app catalog

Wave 1 vertical **TMMT Rentals OS** = this codebase. Other apps reuse base layer; adapt industry content only (see Partner Team Brief in extracts).
