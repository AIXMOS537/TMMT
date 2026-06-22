# Spec: Identity & Privacy Invariants (CI-enforced)
1. No owner PII literals in repo or output. Scan tracked files against a VAULT-sourced denylist (never commit the PII).
2. Public contact must reference config/identity.config.json → public_contact, not inline literals.
3. Personal/work cell = VAULT://work_cell only. Refuse to hardcode; substitute public GHL number.
4. Ghost never surfaces in customer-facing artifacts.
CI: fail build on denylist match in {src,templates,public,exports}; fail on inline contact literals in customer-facing files.
