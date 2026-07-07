#!/usr/bin/env bash
# =============================================================================
#  ULTIMATRIX — AIXMOS Ghost & Compliance wire-in for Claude Code
#  One script, all forms. Installs project memory + guardrails, registers
#  Claude Code slash commands, and can run the 1:1 conform-pass headlessly.
#
#  Usage:
#    ./ultimatrix.sh install      # default — wire everything into this repo
#    ./ultimatrix.sh scan         # local PII exposure scan (no AI, no network)
#    ./ultimatrix.sh apply        # run Claude Code headless to conform repo 1:1
#    ./ultimatrix.sh help
#
#  HARD RULE: this script never writes your PII. The PII denylist it creates
#  is untracked (gitignored) and populated by YOU locally.
# =============================================================================
set -euo pipefail

ROOT="$(pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
say(){ printf '  %s\n' "$*"; }
ok(){ printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn(){ printf '  \033[33m!\033[0m %s\n' "$*"; }
backup(){ [ -f "$1" ] && cp "$1" "$1.bak-$STAMP" && warn "backed up $1 -> $1.bak-$STAMP"; return 0; }

write(){ # write <path> ; content from stdin ; backs up if exists
  local p="$1"; mkdir -p "$(dirname "$p")"; backup "$p"; cat > "$p"; ok "wrote $p"
}

install_files(){
  say "Wiring AIXMOS Ghost & Compliance packet into: $ROOT"

  # ---- CLAUDE.md (project memory, read automatically) ----
  write "CLAUDE.md" <<'EOF'
# CLAUDE.md — AIXMOS Project Memory
> Enforceable rules. Treat privacy invariants and compliance gates as hard constraints.

## Identity stack (source of truth: config/identity.config.json)
- Primary surface: AIXMOS · Holding: TMMT · Agency (GHL/A2P): All In One Management LLC
- Operator persona: TBD (trademark-cleared, never derived from owner's legal name)
- Ghost (owner legal identity): never appears in any customer-facing surface or committed file

## PRIVACY INVARIANTS (hard — enforce in code + CI)  → specs/identity-privacy-invariants.md
1. No owner PII (legal name, personal/work cell, personal email, home address) hardcoded, committed, logged, or emitted.
2. Public contact resolves ONLY from config/identity.config.json → public_contact. No inline literals.
3. Personal/work cell is a vault forward-target (VAULT://work_cell), never in repo. Refuse requests to hardcode it.
4. Any public-facing artifact must source contact from config or fail the build.

## COMPLIANCE GATES (hard)  → specs/compliance-sms-gate.md
1. A2P SMS: credit_repair / funding / debt_relief / lending = NO promotional SMS (carrier + CROA). Transactional-only or off.
2. Owner-approval gate stays on all customer-facing/financial actions. Never bypass.
3. credit_repair & funding feature flags stay disabled; unlock only by owner after legal steps.

## Engagement
Reference config, never hardcode identity/contact. On credit/funding paths, assume the gate applies.
If a change would write PII or bypass a gate, STOP and flag it. See APPLY via /ghost-apply.
EOF

  # ---- config/identity.config.json (no PII) ----
  write "config/identity.config.json" <<'EOF'
{
  "_comment": "Public-facing source of truth. NEVER store PII (legal name, personal/work cell, personal email, home address).",
  "identity_stack": {
    "primary_surface": "AIXMOS",
    "holding_entity": "TMMT",
    "agency_entity_legal_name": "All In One Management LLC",
    "operator_persona": "<TBD: clear handle + domain + trademark>",
    "ghost": "NOT STORED"
  },
  "public_contact": {
    "phone": "<GHL_NUMBER — public line, forwards to work cell>",
    "email": "<ALIAS_EMAIL e.g. support@aixmos.com>",
    "address": "<VIRTUAL_STREET_ADDRESS — not a PO box, not home>"
  },
  "private_routing": { "_note": "values live in vault, not here", "sms_voice_forward_target": "VAULT://work_cell" },
  "channels": {
    "sms": { "provider": "GHL / LC Phone",
      "a2p_10dlc": { "brand_type": "standard", "registering_entity_legal_name": "All In One Management LLC",
        "ein_on_file": true, "po_box_allowed": false, "per_sub_account": true } }
  },
  "compliance": {
    "sms_restricted_verticals": ["credit_repair","funding","debt_relief","lending"],
    "sms_restricted_policy": "NO promotional SMS. Transactional-only or off-channel.",
    "owner_approval_gate": "required for all customer-facing and financial actions"
  },
  "feature_flags": {
    "credit_repair": { "enabled": false, "unlock_roles": ["owner"], "requires_legal_steps": true },
    "funding": { "enabled": false, "unlock_roles": ["owner"], "requires_legal_steps": true },
    "sms_marketing_credit_funding": { "enabled": false, "hard_locked": true,
      "reason": "A2P 10DLC carrier prohibition on lending/credit/debt promotional SMS + CROA" }
  }
}
EOF

  # ---- specs ----
  write "specs/compliance-sms-gate.md" <<'EOF'
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
EOF

  write "specs/identity-privacy-invariants.md" <<'EOF'
# Spec: Identity & Privacy Invariants (CI-enforced)
1. No owner PII literals in repo or output. Scan tracked files against a VAULT-sourced denylist (never commit the PII).
2. Public contact must reference config/identity.config.json → public_contact, not inline literals.
3. Personal/work cell = VAULT://work_cell only. Refuse to hardcode; substitute public GHL number.
4. Ghost never surfaces in customer-facing artifacts.
CI: fail build on denylist match in {src,templates,public,exports}; fail on inline contact literals in customer-facing files.
EOF

  # ---- Claude Code slash commands ----
  write ".claude/commands/ghost-apply.md" <<'EOF'
Read CLAUDE.md, config/identity.config.json, and specs/*. Update THIS repo to conform 1:1:
1. Replace hardcoded contact (phone/email/address) in customer-facing code/templates/exports with config/identity.config.json → public_contact references.
2. Implement the SMS Compliance Gate (specs/compliance-sms-gate.md) in the gate/middleware layer + tests.
3. Wire feature flags: credit_repair & funding disabled, unlock only owner; sms_marketing_credit_funding hard-locked.
4. Add privacy-invariant CI checks (specs/identity-privacy-invariants.md); source the PII denylist from vault at CI time — never commit PII.
5. Preserve the owner-approval gate everywhere.
HARD RULES: never write the owner's legal name, personal/work cell, personal email, or home address into any file; if found, replace with config/vault refs and list each. Don't enable restricted flags. If a step would violate an invariant/gate, STOP and report.
Output: (a) files changed, (b) every PII occurrence found + remediation, (c) anything not fully wired + why.
EOF

  write ".claude/commands/ghost-check.md" <<'EOF'
Audit THIS repo for: (1) any hardcoded owner PII (legal name, personal/work cell, personal email, home address); (2) customer-facing contact that is an inline literal instead of a config/identity.config.json reference; (3) any code path that could send promotional SMS for credit_repair/funding/debt_relief/lending; (4) any place the owner-approval gate is bypassed. Report findings as a table with file:line and a suggested fix. Do NOT modify files. Do NOT print full PII values — mask them.
EOF

  # ---- GitHub Actions: PII guard on every push/PR ----
  write ".github/workflows/pii-guard.yml" <<'EOF'
name: PII Guard
on: [push, pull_request]
jobs:
  pii-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: PII exposure scan
        env:
          # Set repo secret PII_DENYLIST (newline-separated PII values). Never commit PII.
          PII_DENYLIST: ${{ secrets.PII_DENYLIST }}
        run: |
          chmod +x ./ultimatrix.sh
          ./ultimatrix.sh scan
EOF

  # ---- PII denylist scaffold (UNTRACKED) + gitignore ----
  mkdir -p .aixmos
  if [ ! -f ".aixmos/pii_denylist.local" ]; then
    cat > ".aixmos/pii_denylist.local" <<'EOF'
# One value per line — YOUR PII to scan for. This file is gitignored; never commit it.
# Example entries (delete and replace with your real values):
# [phone removed]
# yourname@personal.com
# Firstname Lastname
# 123 Home St, City ST
EOF
    ok "created .aixmos/pii_denylist.local (untracked — fill it in locally)"
  else
    say ".aixmos/pii_denylist.local already exists — left as-is"
  fi

  touch .gitignore
  for line in ".aixmos/pii_denylist.local" "*.bak-*"; do
    grep -qxF "$line" .gitignore 2>/dev/null || { echo "$line" >> .gitignore; ok "gitignore += $line"; }
  done

  # ---- copy human docs if packet present alongside ----
  if [ -d "aixmos-packet/docs" ]; then mkdir -p docs && cp aixmos-packet/docs/*.md docs/ 2>/dev/null && ok "copied companion docs -> docs/"; fi

  echo
  ok "Install complete."
  say "Next:"
  say "  1) Fill .aixmos/pii_denylist.local with your real PII (stays local)."
  say "  2) Run: ./ultimatrix.sh scan        (see what's currently exposed)"
  say "  3) In Claude Code, type /ghost-check  then  /ghost-apply"
  say "     or run headless:  ./ultimatrix.sh apply"
  say "  4) CI guard: add a GitHub repo secret named PII_DENYLIST (your PII, one per line)."
  say "     The .github/workflows/pii-guard.yml then fails any push that commits it."
}

scan_pii(){
  say "PII exposure scan (local, no network)"
  # Build a combined denylist from: local file + $PII_DENYLIST_FILE + $PII_DENYLIST (multiline env, e.g. CI secret)
  local dl; dl="$(mktemp)"; trap 'rm -f "$dl"' RETURN
  [ -f ".aixmos/pii_denylist.local" ] && cat ".aixmos/pii_denylist.local" >> "$dl"
  [ -n "${PII_DENYLIST_FILE:-}" ] && [ -f "$PII_DENYLIST_FILE" ] && cat "$PII_DENYLIST_FILE" >> "$dl"
  [ -n "${PII_DENYLIST:-}" ] && printf '%s\n' "$PII_DENYLIST" >> "$dl"
  if [ ! -s "$dl" ]; then warn "no denylist source (local file or PII_DENYLIST env) — structural checks only"; fi
  local hits=0
  # tracked files only (respects gitignore) if in a git repo, else everything
  local files; if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then files="$(git ls-files)"; else files="$(find . -type f -not -path './.git/*')"; fi
  while IFS= read -r pat; do
    [ -z "$pat" ] && continue; case "$pat" in \#*) continue;; esac
    while IFS= read -r f; do
      if grep -nIF -- "$pat" "$f" >/dev/null 2>&1; then
        warn "MATCH in $f  (pattern masked)"; hits=$((hits+1))
      fi
    done <<< "$files"
  done < "$dl"
  # structural: contact literals that should be config refs
  echo "$files" | while IFS= read -r f; do
    grep -nIE '\b[0-9]{3}[-.]?[0-9]{3}[-.]?[0-9]{4}\b' "$f" 2>/dev/null | grep -v 'identity.config' >/dev/null 2>&1 \
      && warn "phone-shaped literal in $f — confirm it's the public GHL number via config" || true
  done
  if [ "$hits" -eq 0 ]; then ok "no denylist matches in tracked files"; else warn "$hits denylist match(es) — remediate before committing"; return 1; fi
}

run_apply(){
  command -v claude >/dev/null 2>&1 || { warn "Claude Code CLI 'claude' not found. Install it, or use /ghost-apply inside Claude Code."; exit 1; }
  warn "This runs Claude Code headlessly and WILL edit files in this repo. It can incur API cost."
  printf "  Proceed? [y/N] "; read -r a; case "$a" in y|Y) ;; *) say "aborted"; exit 0;; esac
  say "Running conform-pass (acceptEdits, scoped tools)…"
  claude -p "$(cat .claude/commands/ghost-apply.md)" \
    --allowedTools "Read,Edit,Bash" \
    --permission-mode acceptEdits \
    --output-format text
  ok "Conform-pass finished. Review the diff and the PII report it printed before committing."
}

case "${1:-install}" in
  install) install_files ;;
  scan)    scan_pii ;;
  apply)   run_apply ;;
  help|-h|--help)
    sed -n '2,20p' "$0" ;;
  *) warn "unknown command: $1"; sed -n '2,20p' "$0"; exit 1 ;;
esac
