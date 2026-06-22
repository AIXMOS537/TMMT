# GATE-FLIP CHECKLIST (for Muhammad + Umar)

The credit/funding features are built but DARK. Each gate below stays `false` in
`shared/compliance-gates/gates.config.json` until you complete the legal step, then
you (a human) flip it to `true`. Do them in this order.

| # | Legal step (Virginia) | Flip this gate to true | Who |
|---|---|---|---|
| 1 | VA attorney approves the CROA service agreement + SEPARATE disclosure statement + 3-day Notice of Cancellation | `croa_contracts_attorney_approved` | Attorney |
| 2 | Register credit services business with VDACS + post surety bond (100x fee; $5k–$50k) | `vdacs_registered_bonded` | You + surety |
| 3 | Confirm billing never charges before service performed (review the unit-test evidence) | `no_advance_fee_billing_enforced` | You |
| 4 | ONLY if doing MCA/RBF: register as VA sales-based financing broker with the SCC ($1,000 + $500/yr) and ship the 9-item disclosure form | `sbf_broker_registered` | You |
| — | Permanent. Never flip off. CPNs + rented tradelines stay banned. | `cpn_and_rented_tradelines_blocked` (stays true) | — |
| — | DO NOT build a pooled fund. Use CDFI + Virginia SSBCI partnerships instead. | `securities_counsel_cleared_fund` (stays false) | Securities counsel only if ever pursued |
| 5 | Before leaving Virginia: complete the state-by-state matrix (credit services reg + commercial-financing disclosure laws) per target state | `multistate_matrix_cleared` | Attorney |

After each flip, run `python3 shared/compliance-gates/check.py` and re-run the workstream-2 tests.

You can launch WS1 (AIXMOS core) and WS3 (operator network, refer-only + funding via
cards/LOC/SBA/equipment) BEFORE any credit-repair gate opens. The credit-repair pipeline
simply stays dark until gates 1–3 are green.
