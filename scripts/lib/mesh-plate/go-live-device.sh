#!/usr/bin/env bash
# go-live-device.sh — one command per mesh node for market launch.
# Run AFTER swarm-join on each machine. Assigns role-specific work.
#
# Usage:
#   bash scripts/mesh/go-live-device.sh --role carry
#   bash scripts/mesh/go-live-device.sh --role forge
#   bash scripts/mesh/go-live-device.sh --role brain
#   bash scripts/mesh/go-live-device.sh --role ops
#   bash scripts/mesh/go-live-device.sh --role family
#   bash scripts/mesh/go-live-device.sh --role all
#
# Roles map to MESH-COORDINATION.md nodes + AI-OPS brainiac tiers.
set -uo pipefail
source "$(dirname "$0")/../lib/swarm-common.sh"
cd "$SWARM_ROOT"

ROLE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --role) ROLE="${2:-}"; shift 2 ;;
    -h|--help)
      cat <<'EOF'
TMMT mesh go-live — run on EVERY device once.

Roles:
  carry   CARRY Mac — owner field node, approvals, iMessage relay check
  forge   FORGE — M1/work Mac — build, test, deploy candidate
  brain   BRAIN — Brainiac PC — local AI stack + memory vault sync
  ops     OPS laptop — closers/setters smoke + GHL helper checks
  family  Immediate family device — Enchanted + Rick-safe + mesh presence
  all     Run every check this machine can (safe default)

Then on FORGE only (after GHL env set):
  vercel --prod
  npm run ghl:test-webhook payment

Integration test (FORGE or CARRY after deploy):
  bash scripts/mesh/go-live-integration-test.sh
EOF
      exit 0
      ;;
    *) die "unknown arg: $1 (use --role carry|forge|brain|ops|family|all)" ;;
  esac
done
[[ -n "$ROLE" ]] || die "pass --role (carry|forge|brain|ops|family|all)"

say "${BOLD}=== TMMT Go-Live Device Boot — role: ${ROLE} — $(swarm_machine) ===${RST}"
say "Canon: docs/GO-LIVE-CANON.md"

step() { info "$1"; }

# ── ALL ROLES ─────────────────────────────────────────────────────────────
boot_common() {
  step "1/5  Read canon (first 40 lines)"
  head -40 "$SWARM_ROOT/docs/GO-LIVE-CANON.md" 2>/dev/null || warn "GO-LIVE-CANON.md missing"
  step "2/5  Mesh join check"
  [[ -f "$SWARM_ROOT/.swarm/machine" ]] \
    && ok "machine: $(cat "$SWARM_ROOT/.swarm/machine")" \
    || warn "run: bash scripts/swarm-join.sh --name YOUR-UNIQUE-NAME"
  step "3/5  Security doctor"
  bash "$SWARM_ROOT/scripts/swarm-doctor.sh" --quick || warn "doctor reported issues"
  step "4/5  Sync repo"
  bash "$SWARM_ROOT/scripts/sync-machine.sh" status || true
  step "5/5  Revenue env audit (local .env — no secrets printed)"
  npm run ghl:check 2>/dev/null | head -25 || warn "ghl:check failed or npm missing"
}

# ── CARRY ─────────────────────────────────────────────────────────────────
boot_carry() {
  boot_common
  say "${BOLD}— CARRY tasks (owner approvals only) —${RST}"
  step "iMessage relay reachability"
  if [[ -n "${IMESSAGE_RELAY_URL:-}" ]]; then
    curl -sf -o /dev/null -w "relay HTTP %{http_code}\n" "${IMESSAGE_RELAY_URL%/send}/health" 2>/dev/null \
      || warn "IMESSAGE_RELAY_URL set but health check failed"
  else
    warn "IMESSAGE_RELAY_URL not in env — handoffs may be Slack-only"
  fi
  step "Unison base online"
  bash "$SWARM_ROOT/scripts/mesh/unison.sh" status || true
  say "CARRY manual gates:"
  say "  • Pause GHL \$203 dunning workflow"
  say "  • Approve prod deploy from FORGE"
  say "  • Paste GHL checkout URLs → Vercel → npm run ghl:sync-vercel"
  ok "CARRY boot complete"
}

# ── FORGE (build + deploy machine) ────────────────────────────────────────
boot_forge() {
  boot_common
  say "${BOLD}— FORGE tasks (build / test / deploy) —${RST}"
  step "Install deps"
  npm ci --prefer-offline 2>/dev/null || npm install
  step "Unit tests (agent FSM)"
  npm run test -- --run src/lib/agent 2>/dev/null || warn "some unit tests failed"
  step "Production build"
  npm run build || die "build failed — fix before deploy"
  step "Go-live audit"
  npm run go-live || warn "go-live audit reported blockers (expected until GHL URLs set)"
  step "Prod smoke (public routes)"
  npm run smoke:prod || warn "smoke:prod failed — deploy middleware/LP fixes first"
  say "FORGE deploy (owner approval required):"
  say "  vercel --prod"
  say "  npm run ghl:test-webhook payment"
  say "  bash scripts/mesh/go-live-integration-test.sh"
  ok "FORGE boot complete"
}

# ── BRAIN (Brainiac / local AI) ────────────────────────────────────────────
boot_brain() {
  boot_common
  say "${BOLD}— BRAIN tasks (local AI + memory) —${RST}"
  if [[ -d "$HOME/AI-OPS-STARTER" || -d "$HOME/projects/AI-OPS-STARTER" ]]; then
    step "AI-OPS-STARTER stack check"
    OPS="${HOME}/projects/AI-OPS-STARTER"
    [[ -d "$OPS" ]] || OPS="${HOME}/AI-OPS-STARTER"
    if [[ -f "$OPS/docker-compose.yml" || -f "$OPS/compose.yml" ]]; then
      (cd "$OPS" && docker compose ps 2>/dev/null) || warn "docker compose not running in AI-OPS-STARTER"
    fi
  else
    warn "AI-OPS-STARTER not found — clone ~/projects/AI-OPS-STARTER for Brainiac stack"
  fi
  step "Memory vault sync"
  if [[ -n "${HAILMARY_VAULT:-}" ]]; then
    bash "$SWARM_ROOT/scripts/mesh/memory-sync.sh" once || true
  else
    warn "Set HAILMARY_VAULT to BRAINIAC Obsidian path for memory loop"
  fi
  step "Ollama models (if installed)"
  command -v ollama >/dev/null && ollama list 2>/dev/null | head -5 || warn "ollama not installed"
  ok "BRAIN boot complete"
}

# ── OPS (closers / setters / Aayan / Isaac Scott laptops) ───────────────────
boot_ops() {
  local machine
  machine="$(cat "$SWARM_ROOT/.swarm/machine" 2>/dev/null || echo "")"
  case "$machine" in
    *aayan*|*ops-aayan*)
      if ! bash "$SWARM_ROOT/scripts/mesh/owner-devices-first.sh" gate aayan 2>/dev/null; then
        die "Aayan onboarding LOCKED — finish family phase first · owner: unlock-aayan"
      fi
      say "${BOLD}— AAYAN ops lane (VA · AIXMOS scoped) —${RST}"
      ;;
    *isaac*|*ops-isaac*)
      if ! bash "$SWARM_ROOT/scripts/mesh/owner-devices-first.sh" gate isaac 2>/dev/null; then
        die "Isaac Scott LOCKED — finish Aayan phase first · owner: unlock-isaac"
      fi
      say "${BOLD}— ISAAC SCOTT ops lane (Operator T1 · tracked links · 30%) —${RST}"
      say "  Fit test: https://tmmt-ops.vercel.app/fit-test → /join"
      ;;
    *)
      say "${BOLD}— OPS tasks (sales floor) —${RST}"
      ;;
  esac
  boot_common
  step "Closer playbook location"
  say "  docs/CLOSER_PLAYBOOK_V1.md"
  step "Nightly call sheet (if Airtable key present)"
  if [[ -f "$HOME/.config/tmmt/airtable.env" ]]; then
    python3 "$SWARM_ROOT/va-liberation/triage_leads.py" && ok "call sheet written to ~/Brain/vault/02-Needs-You/"
  else
    warn "No ~/.config/tmmt/airtable.env — call sheet skipped"
  fi
  step "Public pitch pages reachable"
  BASE="${SMOKE_BASE_URL:-https://tmmt-ops.vercel.app}"
  for p in /kits /credit /forms/credit-funding-intake /join; do
    code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$BASE$p" 2>/dev/null || echo ERR)
    [[ "$code" == "200" ]] && ok "$p → $code" || warn "$p → $code"
  done
  say "OPS daily floor:"
  say "  • GHL tags: hot-ready-now | warm-this-week | unqualified"
  say "  • Closers only see hot/warm (CLOSER_PLAYBOOK §5)"
  ok "OPS boot complete"
}

# ── FAMILY (immediate family — Rick via HAILMARY, not public AIXMOS) ───────
boot_family() {
  if ! bash "$SWARM_ROOT/scripts/mesh/owner-devices-first.sh" gate 2>/dev/null; then
    warn "FAMILY onboarding LOCKED — BLIP YOUR devices first"
    say ""
    say "  bash scripts/blip/rollout-now.sh          # build + BLIP queue NOW"
    say "  bash scripts/tmmt owner                   # your checklist"
    say "  bash scripts/tmmt owner unlock-family     # override when ready"
    die "Phase 2 blocked until Phase 1 owner devices complete"
  fi
  boot_common
  say "${BOLD}— FAMILY tasks (immediate circle · Rick-safe) —${RST}"
  step "Family mesh harness status"
  bash "$SWARM_ROOT/scripts/mesh/family-harness.sh" status 2>/dev/null || warn "family-harness status failed"
  step "Tailscale (required for Enchanted → Carry LiteLLM)"
  command -v tailscale >/dev/null \
    && tailscale status 2>/dev/null | head -8 | sed 's/^/   /' \
    || warn "Install Tailscale — same tailnet as Carry"
  step "Enchanted / LibreChat setup"
  say "  URL:  http://macbook-pro-2.tailceb455.ts.net:4001"
  say "  Key:  LiteLLM virtual key (rick-safe) — ask Taha: god issue family"
  say "  NEVER: master key · FOUNDER key · vault paths"
  step "Structure-First Pathway (if earning as operator)"
  BASE="${SMOKE_BASE_URL:-https://tmmt-ops.vercel.app}"
  for p in /fit-test /join; do
    code=$(curl -sS -o /dev/null -w "%{http_code}" -L --max-time 15 "$BASE$p" 2>/dev/null || echo ERR)
    [[ "$code" == "200" ]] && ok "$p → $code" || warn "$p → $code"
  done
  step "Mesh presence (stay reachable for help)"
  bash "$SWARM_ROOT/scripts/mesh/presence.sh" beat family online 2>/dev/null || true
  bash "$SWARM_ROOT/scripts/mesh/install-forever-loop.sh" install family 180 2>/dev/null \
    && ok "forever-loop installed (family role)" \
    || say "  Optional: bash scripts/mesh/install-forever-loop.sh install family 180"
  say "FAMILY daily:"
  say "  • Enchanted for Rick help (rick-safe only)"
  say "  • bash scripts/tmmt help \"what I need\" — SOS to owner"
  say "  • bash scripts/mesh/family-harness.sh test — verify everything"
  ok "FAMILY boot complete"
}

case "$ROLE" in
  carry) boot_carry ;;
  forge) boot_forge ;;
  brain) boot_brain ;;
  ops)   boot_ops ;;
  family) boot_family ;;
  all)
    boot_common
    boot_ops
    ;;
  *) die "unknown role: $ROLE" ;;
esac

say ""
say "Next: bash scripts/mesh/go-live-integration-test.sh (after FORGE deploys)"
say "Mesh roster: bash scripts/tmmt mesh"
