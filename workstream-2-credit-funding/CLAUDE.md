# WS2 — Credit + Funding Vertical (COMPLIANCE-GATED)

Goal: build Umar's credit repair + business funding agency as an AIXMOS pipeline.
Read root `/CLAUDE.md` (esp. section 3) and `00_START_HERE/BUILD_BRIEF.md` first.

BUILD FULL, SHIP DARK. Build the whole pipeline but legal gates stay false until
a human flips them post-attorney-sign-off. Launch Virginia only.

Hard rules:
- requireGate() before every legally gated action (see shared/compliance-gates).
- assertNoCpnOrRentedTradelines() on every intake/dispute record. CPNs and bought/
  rented tradelines are permanently banned — detect, reject, flag for owner review.
- Every dispute letter + funding submission routes through shared/owner-approval-gate.
  Never auto-send a dispute. Never auto-submit a funding app.
- Funding desk: cards/LOC/SBA/equipment can launch without extra license.
  MCA/RBF blocked behind sbf_broker_registered + 9-item disclosure workflow.
- Community capital (Rung 4) = CDFI + Virginia SSBCI referrals. DO NOT build a pooled fund.
- Never take custody of client funds.
