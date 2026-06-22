# Spec: SMS Compliance Gate
Block SMS where vertical ∈ {credit_repair,funding,debt_relief,lending} AND type == marketing.
Restricted verticals: transactional-only (registered use case). Enforce at send-time AND campaign-config time.

Pseudocode:
  if msg.vertical in restricted:
     if msg.type == "marketing": return BLOCK
     if flags.sms_marketing_credit_funding.hard_locked and msg.type=="marketing": return BLOCK
  if requiresOwnerApproval(msg) and not msg.owner_approved: return HOLD
  return ALLOW

Tests: marketing+credit_repair→BLOCK; marketing+funding→BLOCK; transactional+credit_repair→ALLOW;
marketing+rentals→ALLOW(after approval); any restricted+marketing while hard_locked→BLOCK.
