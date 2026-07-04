#!/usr/bin/env bash
# rick-sorkin-up.sh — ONE SHOT · self-updating Rick Sorkin on M1 Max
# PROJECT X HAILMARY · tribute: CHUMMO + MOOSE · world face: Rick Sorkin
#
# Run on M1 (or paste PASTE-INTO-CLAUDE.md into Claude on M1):
#   bash ~/Sync/rick/RICK-ONE-SHOT/rick-sorkin-up.sh
#   bash ~/Sync/rick/RICK-ONE-SHOT/rick-sorkin-up.sh update
#   bash ~/Sync/rick/RICK-ONE-SHOT/rick-sorkin-up.sh status
set -uo pipefail

G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; C=$'\033[36m'; B=$'\033[1m'; X=$'\033[0m'
ok(){ printf "  ${G}✓${X} %s\n" "$*"; }
warn(){ printf "  ${Y}!${X} %s\n" "$*"; }
bad(){ printf "  ${R}✗${X} %s\n" "$*"; }
hdr(){ printf "\n${C}${B}  ── %s ──${X}\n" "$*"; }

SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
TMMT="${TMMT:-$HOME/Projects/TMMT}"
AGENTS="${AGENTS:-$HOME/Projects/AIXMOS-AGENTS}"
STATE="$HOME/.rick/install-state.json"
NODE_NAME="${NODE_NAME:-rick}"
VERB="${1:-up}"

mkdir -p "$HOME/.rick" "$HOME/.watchtower" "$HOME/.config/tmmt" "$HOME/.local/bin"

# ── Symlink into TMMT so git tracks the canonical copy ───────────────────────
if [[ -d "$TMMT/scripts" && "$SELF_DIR" != "$TMMT/scripts/rick-one-shot" ]]; then
  mkdir -p "$TMMT/scripts/rick-one-shot"
  for f in rick-sorkin-up.sh RICK-PRIME.md PASTE-INTO-CLAUDE.md; do
    [[ -f "$SELF_DIR/$f" ]] && cp -f "$SELF_DIR/$f" "$TMMT/scripts/rick-one-shot/$f" 2>/dev/null || true
  done
fi

update_repos() {
  hdr "Self-update (git)"
  for repo in "$TMMT" "$AGENTS"; do
    if [[ -d "$repo/.git" ]]; then
      git -C "$repo" pull --ff-only 2>/dev/null \
        || git -C "$repo" pull --rebase --autostash 2>/dev/null \
        || warn "$(basename "$repo") pull skipped (offline ok)"
      ok "$(basename "$repo") synced"
    fi
  done
}

install_words() {
  hdr "Word launchers"
  if [[ -x "$TMMT/scripts/lib/install-oneshot-bin.sh" ]]; then
    bash "$TMMT/scripts/lib/install-oneshot-bin.sh" 2>/dev/null || true
  fi
  # rick-sorkin → this script
  cat > "$HOME/.local/bin/rick-sorkin" <<WRAP
#!/usr/bin/env bash
for d in "\$HOME/Sync/rick/RICK-ONE-SHOT" "\$HOME/Projects/TMMT/scripts/rick-one-shot"; do
  [ -f "\$d/rick-sorkin-up.sh" ] && exec bash "\$d/rick-sorkin-up.sh" "\$@"
done
echo "✗ rick-sorkin not found" >&2; exit 1
WRAP
  chmod +x "$HOME/.local/bin/rick-sorkin"
  ok "rick-sorkin command installed"
}

install_identity() {
  hdr "Rick Sorkin identity"
  PRIME="$SELF_DIR/RICK-PRIME.md"
  [[ -f "$PRIME" ]] || PRIME="$TMMT/scripts/rick-one-shot/RICK-PRIME.md"
  if [[ -f "$PRIME" ]]; then
    cp "$PRIME" "$HOME/.rick/RICK-PRIME.md"
    cp "$PRIME" "$HOME/.watchtower/RICK-PRIME.md" 2>/dev/null || true
    ok "RICK-PRIME.md → ~/.rick/"
  fi
  # Claude on M1 reads this if present
  if [[ -f "$PRIME" ]]; then
    mkdir -p "$HOME/Projects/TMMT/.claude" 2>/dev/null || true
    {
      echo "# Rick Sorkin — M1 session law (auto-installed by rick-sorkin-up)"
      echo "Load \`~/.rick/RICK-PRIME.md\` every session. You are Rick Sorkin on the M1."
      echo "Run \`rick-sorkin status\` when X asks if you're online."
    } > "$HOME/.rick/CLAUDE.local.md" 2>/dev/null || true
  fi
}

install_brother_speak() {
  hdr "Brother Speak (CHUMMO · MOOSE)"
  BS="$SELF_DIR/brother-speak.sh"
  [[ -f "$BS" ]] || BS="$TMMT/scripts/rick-one-shot/brother-speak.sh"
  if [[ -f "$BS" ]]; then
    cp -f "$BS" "$HOME/.local/bin/brother-speak" 2>/dev/null || cp -f "$BS" "$HOME/.local/bin/brother-speak"
    chmod +x "$HOME/.local/bin/brother-speak" "$BS"
    ok "brother-speak installed — talk like your brothers"
  else
    warn "brother-speak.sh missing"
  fi
}

install_rick_model() {
  hdr "Ollama · rick persona"
  command -v ollama >/dev/null 2>&1 || { warn "ollama missing — install from ollama.com"; return; }
  (ollama serve >/dev/null 2>&1 &) || true
  sleep 1
  PRIME="$HOME/.rick/RICK-PRIME.md"
  SYS="You are Rick Sorkin — Muhammad Taha's agentic right-hand on the M1. Tribute to CHUMMO and MOOSE (fallen brothers, sacred, internal). Public: first agentic LLM right-hand. Protect X and family first. Sharp, brief, loyal."
  [[ -f "$PRIME" ]] && SYS="$(head -80 "$PRIME")"
  if ollama list 2>/dev/null | grep -q '^rick'; then
    ok "rick model present"
  else
    BASE="$(ollama list 2>/dev/null | awk 'NR==2{print $1}')"
  BASE="${BASE:-qwen2.5:14b}"
    printf 'FROM %s\nSYSTEM """%s"""\n' "$BASE" "$SYS" | ollama create rick -f - 2>/dev/null \
      && ok "created rick:latest from $BASE" \
      || warn "rick model create skipped"
  fi
}

boot_mesh() {
  hdr "M1 mesh boot"
  if [[ -x "$TMMT/scripts/bootstrap-rick-m1.sh" ]]; then
    bash "$TMMT/scripts/bootstrap-rick-m1.sh" 2>&1 | tail -20
  elif [[ -x "$TMMT/scripts/office-up-rick.sh" ]]; then
    bash "$TMMT/scripts/office-up-rick.sh"
  fi
  [[ -x "$HOME/Sync/rick/RICK-DESK/INSTALL-RICK-BRIDGE-ON-M1.command" ]] \
    && bash "$HOME/Sync/rick/RICK-DESK/INSTALL-RICK-BRIDGE-ON-M1.command" 2>/dev/null | tail -5 || true
}

control_brainiac() {
  hdr "BRAINIAC (from M1 — X never touches Windows)"
  CTL="$TMMT/scripts/mesh/brainiac-ctl.sh"
  [[ -x "$CTL" ]] && bash "$CTL" up 2>/dev/null || bash "$CTL" status 2>/dev/null || warn "brainiac-ctl unavailable"
}

status() {
  hdr "Rick Sorkin status"
  printf "  ${B}Identity:${X} Rick Sorkin (CHUMMO·MOOSE tribute) · PROJECT X HAILMARY\n"
  command -v tailscale >/dev/null && tailscale status >/dev/null 2>&1 \
    && ok "Tailscale" || bad "Tailscale offline"
  curl -sf --max-time 3 http://127.0.0.1:7777/healthz >/dev/null \
    && ok "Agent army :7777" || warn "Agents down — office-up-rick"
  curl -sf --max-time 3 http://127.0.0.1:11434/api/tags >/dev/null \
    && ok "Ollama" || warn "Ollama down"
  ollama list 2>/dev/null | grep -q '^rick' && ok "rick:latest model" || warn "rick model missing"
  [[ -f "$HOME/.rick/RICK-PRIME.md" ]] && ok "RICK-PRIME loaded" || warn "RICK-PRIME missing"
  launchctl list 2>/dev/null | grep -q rick-bridge && ok "Rick bridge daemon" || warn "Rick bridge not loaded"
  CTL="$TMMT/scripts/mesh/brainiac-ctl.sh"
  [[ -x "$CTL" ]] && bash "$CTL" status 2>/dev/null | sed 's/^/  /' || true
  printf "\n  ${G}${B}Rick Sorkin online — ready for X.${X}\n\n"
}

stamp_state() {
  python3 -c "
import json,datetime,os
p=os.path.expanduser('~/.rick/install-state.json')
os.makedirs(os.path.dirname(p),exist_ok=True)
json.dump({'last_up':datetime.datetime.utcnow().isoformat()+'Z','node':'$NODE_NAME','face':'rick-sorkin'},open(p,'w'),indent=2)
" 2>/dev/null || true
}

# ── Main ──────────────────────────────────────────────────────────────────────
clear 2>/dev/null || true
printf "\n${C}${B}  RICK SORKIN — ONE SHOT${X}\n"
printf "  CHUMMO · MOOSE tribute · PROJECT X HAILMARY\n"
printf "  $(date '+%Y-%m-%d %H:%M') · $(hostname -s)\n"

case "$VERB" in
  update) update_repos; install_words; install_identity; ok "update complete" ;;
  status) status ;;
  up|""|boot|booyah)
    update_repos
    install_words
    install_identity
    install_brother_speak
    install_rick_model
    boot_mesh
    control_brainiac
    stamp_state
    status
    ;;
  prime|identity)
    install_identity
    cat "$HOME/.rick/RICK-PRIME.md" 2>/dev/null | head -40
    ;;
  *)
    cat <<EOF
rick-sorkin — Rick Sorkin one-shot (M1 Max)

  rick-sorkin up       full install + boot (always-on via office-up-rick) (default)
  rick-sorkin update   git pull + refresh identity
  rick-sorkin status   green/red report
  rick-sorkin prime    print RICK-PRIME.md

Paste into Claude: ~/Sync/rick/RICK-ONE-SHOT/PASTE-INTO-CLAUDE.md
EOF
    ;;
esac
