# WS2 TASKS  (all legal gates start FALSE)

## intake/
- [ ] GoHighLevel funnel capture → classify funding-ladder rung
- [ ] Generate CROA contract + SEPARATE disclosure statement + 3-day cancellation notice
      (gated: croa_contracts_attorney_approved AND vdacs_registered_bonded)
- [ ] e-sign flow (UETA/E-SIGN); store signed disclosure
- [ ] assertNoCpnOrRentedTradelines() on every record (gate stays TRUE)
- [ ] PII to NAS tier only

## dispute-engine/
- [ ] Local LLM (Ollama) drafts FCRA dispute letters from identified inaccuracies
- [ ] EVERY letter -> owner-approval gate (dispute_letter); no auto-send
- [ ] 30-day bureau reinvestigation clock + status tracking
- [ ] Honest framing: accurate items can't be removed; disclose free-dispute right

## tradeline-tracker/
- [ ] Net-30 vendor tracking (Quill/Uline/Grainger-type), bureau reporting status
- [ ] PAYDEX / business-bureau progression
- [ ] Payment due reminders
- [ ] Legitimate relationship-based AU only — NO rented tradelines

## funding-desk/
- [ ] Build business funding package (profile + revenue docs + use-of-funds)
- [ ] Product matcher: 0% cards, LOC, SBA/term, equipment (launchable)
- [ ] MCA/RBF path gated: sbf_broker_registered + 9-item VA disclosure form
- [ ] Every submission -> owner-approval gate (submit_funding_app)
- [ ] Teach decision rule: cards->LOC->SBA->equipment->RBF before MCA

## compliance/
- [ ] CDFI partner referral integration
- [ ] Virginia SSBCI (VSBFA) program referral integration for Rung 4
- [ ] securities_counsel_cleared_fund stays FALSE (no pooled fund by design)

## BLOCKED — needs human (gate-flip checklist)
- [ ] VA attorney approves CROA suite -> flip croa_contracts_attorney_approved
- [ ] VDACS registration + surety bond -> flip vdacs_registered_bonded
- [ ] Prove no-advance-fee billing -> flip no_advance_fee_billing_enforced
- [ ] SCC sales-based-financing broker reg (only if doing MCA/RBF) -> flip sbf_broker_registered
