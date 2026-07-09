#!/usr/bin/env bash
#
# agents-setup.sh — the agentic TOOLBELT for every PROJECT X HAILMARY device.
# ---------------------------------------------------------------------------
# Detects (and, with --install, installs) the best-of-best coding agents so any
# device can run the mesh + factory line: Claude Code, OpenAI Codex CLI, Cursor
# CLI, VS Code, Ollama (local brain), GitHub CLI. Cross-platform: macOS (brew +
# npm), Linux (npm + native installers), with Windows guidance.
#
# SAFE BY DEFAULT: with no flags it only REPORTS what's present (no installs).
#   bash scripts/agents-setup.sh              # detect + print readiness table
#   bash scripts/agents-setup.sh --install    # install the safe CLIs (npm + ollama + gh)
#   bash scripts/agents-setup.sh --all        # + editors (VS Code / Cursor app) where possible
#
# Idempotent, non-fatal: a tool that won't install prints how-to and we continue.
# Never installs keys/secrets — those are added per-device AFTER, never here.
# ---------------------------------------------------------------------------
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd 2>/dev/null || echo "$PWD")"
if [ -t 1 ]; then G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; D=$'\e[2m'; B=$'\e[1m'; X=$'\e[0m'; else G=; Y=; R=; C=; D=; B=; X=; fi
ok(){ printf '%s  ✓ %s%s\n' "$G" "$*" "$X"; }
info(){ printf '  › %s\n' "$*"; }
warn(){ printf '%s  ! %s%s\n' "$Y" "$*" "$X"; }
osname(){ case "$(uname -s 2>/dev/null)" in Darwin) echo macos;; Linux) echo linux;; *) echo other;; esac; }

MODE=detect
for a in "$@"; do case "$a" in
  --install) MODE=install;; --all) MODE=all;;
  -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
  *) warn "ignoring unknown arg: $a";;
esac; done
OS="$(osname)"

have(){ command -v "$1" >/dev/null 2>&1; }
brew_ensure(){
  have brew && return 0
  [ "$OS" = macos ] || return 1
  info "Homebrew not found — installing (may ask for your Mac password)…"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || return 1
  [ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
  [ -x /usr/local/bin/brew ]   && eval "$(/usr/local/bin/brew shellenv)"
  have brew
}
ensure_node(){
  have npm && return 0
  info "Node.js/npm missing — needed for the CLI agents…"
  if [ "$OS" = macos ] && brew_ensure; then brew install node || true; fi
  have npm
}

say_header(){
  printf '\n%s╔══════════════════════════════════════════════╗%s\n' "$C" "$X"
  printf '%s║   AIXMOS AGENT TOOLBELT — %-18s ║%s\n' "$C" "$OS/$MODE" "$X"
  printf '%s╚══════════════════════════════════════════════╝%s\n' "$C" "$X"
}

# Fields (delimiter ':::' so native installers may contain '|' pipes):
#   name ::: probe-cmd ::: npm-pkg(or -) ::: mac-brew(or -) ::: native-installer(or -) ::: note
TOOLS=(
  "GitHub CLI:::gh:::-:::gh:::-:::repo/PR ops (auth: gh auth login)"
  "Ollama (local brain):::ollama:::-:::ollama:::curl -fsSL https://ollama.com/install.sh | sh:::local-first models — free tier"
  "Claude Code:::claude:::@anthropic-ai/claude-code:::-:::-:::Anthropic agent CLI"
  "OpenAI Codex CLI:::codex:::@openai/codex:::-:::-:::OpenAI agent CLI"
  "Cursor CLI:::cursor:::-:::-:::curl https://cursor.com/install -fsS | bash:::Cursor agent in the terminal"
)
EDITORS=(
  "VS Code:::code:::-:::--cask visual-studio-code:::-:::editor + agent extensions"
)

install_one(){ # fields: name probe npm brew native note
  local name="$1" probe="$2" npmpkg="$3" brewpkg="$4" native="$5"
  if have "$probe"; then ok "$name — present"; return 0; fi
  if [ "$MODE" = detect ]; then warn "$name — missing (run with --install)"; return 0; fi
  info "installing $name…"
  if [ "$npmpkg" != "-" ] && ensure_node; then npm install -g "$npmpkg" >/dev/null 2>&1 && { ok "$name installed (npm)"; return 0; }; fi
  if [ "$brewpkg" != "-" ] && [ "$OS" = macos ] && brew_ensure; then brew install $brewpkg >/dev/null 2>&1 && { ok "$name installed (brew)"; return 0; }; fi
  if [ "$native" != "-" ]; then bash -c "$native" >/dev/null 2>&1 && have "$probe" && { ok "$name installed (native)"; return 0; }; fi
  warn "$name — could not auto-install. Manual: ${npmpkg/-/}${brewpkg/-/} ${native/-/}"
  return 0
}

say_header
info "OS: $OS   mode: $MODE   (detect = report only; --install = set up CLIs)"
printf '\n%sCore agent CLIs%s\n' "$B" "$X"
for row in "${TOOLS[@]}"; do IFS=$'\n' read -r -d '' name probe npmpkg brewpkg native note < <(printf '%s' "${row//:::/$'\n'}" && printf '\0'); install_one "$name" "$probe" "$npmpkg" "$brewpkg" "$native"; printf '      %s%s%s\n' "$D" "$note" "$X"; done

if [ "$MODE" = all ]; then
  printf '\n%sEditors%s\n' "$B" "$X"
  for row in "${EDITORS[@]}"; do IFS=$'\n' read -r -d '' name probe npmpkg brewpkg native note < <(printf '%s' "${row//:::/$'\n'}" && printf '\0'); install_one "$name" "$probe" "$npmpkg" "$brewpkg" "$native"; done
else
  printf '\n%s(editors skipped — pass --all to include VS Code / Cursor app)%s\n' "$D" "$X"
fi

# Windows note (this script is bash; PS1 path is the aixmos-deploy repo).
printf '\n%sWindows / Brainiac PC:%s use the keyless node deploy —\n' "$B" "$X"
printf '  %sirm https://raw.githubusercontent.com/AIXMOS537/aixmos-deploy/main/deploy-node.ps1 | iex%s\n' "$D" "$X"
printf '  %s(installs Tailscale + Syncthing + Ollama; keys added per-machine after)%s\n' "$D" "$X"

# Readiness summary line.
present=0; total=0
for row in "${TOOLS[@]}"; do probe="${row#*:::}"; probe="${probe%%:::*}"; total=$((total+1)); have "$probe" && present=$((present+1)); done
printf '\n%sReady: %s/%s core agent CLIs on this device.%s\n' "$B" "$present" "$total" "$X"
[ "$MODE" = detect ] && printf '%sNext: bash scripts/agents-setup.sh --install%s\n' "$D" "$X"
printf '%sThen point any of them at docs/FACTORY-LINE.md and run: bash scripts/tmmt factory%s\n\n' "$D" "$X"
