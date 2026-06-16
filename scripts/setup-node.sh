#!/usr/bin/env bash
#
# setup-node.sh — one command to turn ANY Mac/Linux box into an AIXMOS node.
# ---------------------------------------------------------------------------
# Simple enough to be copy-paste: it detects the OS, checks the license key,
# installs what's missing, pulls a local model, wires the fact-check gate, and
# self-verifies. Dry-run by default; add --apply to actually change the machine.
#
#   bash scripts/setup-node.sh --license AIXMOS-XXXX-XXXX-XXXX-XXXX            # preview
#   bash scripts/setup-node.sh --apply --license AIXMOS-XXXX-XXXX-XXXX-XXXX    # do it
#   AIXMOS_LICENSE_KEY=... bash scripts/setup-node.sh --apply --role carry
#
# Flags: --apply  --license KEY  --role carry|work|brainiac|node  --model NAME
# Env:   AIXMOS_LICENSE_KEY, AIXMOS_LICENSE_URL (optional activation endpoint)
# ---------------------------------------------------------------------------
set -uo pipefail

bold(){ printf "\033[1m%s\033[0m\n" "$1"; }
ok(){ printf "\033[32m✓\033[0m %s\n" "$1"; }
bad(){ printf "\033[31m✗ %s\033[0m\n" "$1" >&2; }
warn(){ printf "\033[33m!\033[0m %s\n" "$1"; }
step(){ printf "\n\033[1m▶ %s\033[0m\n" "$1"; }
die(){ bad "$1"; exit 1; }

APPLY=false; ROLE="node"; MODEL="qwen2.5-coder:14b"; LICENSE="${AIXMOS_LICENSE_KEY:-}"
while [ $# -gt 0 ]; do case "$1" in
  --apply) APPLY=true; shift;;
  --license) LICENSE="${2:-}"; shift 2;;
  --role) ROLE="${2:-node}"; shift 2;;
  --model) MODEL="${2:-}"; shift 2;;
  -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
  *) die "unknown arg: $1 (try --help)";;
esac; done

run(){ if $APPLY; then echo "  + $*"; "$@"; else echo "  would run: $*"; fi; }
# pipe_install: fetch a remote installer and run it — ONLY on --apply (no network in dry-run).
pipe_install(){ local url="$1"; if $APPLY; then echo "  + curl -fsSL $url | sh"; curl -fsSL "$url" | sh; else echo "  would run: curl -fsSL $url | sh"; fi; }
have(){ command -v "$1" >/dev/null 2>&1; }

bold "== AIXMOS node setup =="
echo "mode: $([ "$APPLY" = true ] && echo APPLY || echo DRY-RUN)   role: $ROLE   model: $MODEL"

# ---- 0. platform
OS="$(uname -s)"; ARCH="$(uname -m)"
case "$OS" in
  Darwin) PLAT=mac; PKG=brew;;
  Linux)  PLAT=linux; have apt-get && PKG=apt || PKG=none;;
  *) die "Unsupported OS '$OS'. On Windows use scripts/setup-node.ps1 (PowerShell).";;
esac
ok "platform: $PLAT/$ARCH (pkg: $PKG)"

# ---- 1. license gate (the "proper license key")
step "License"
LICENSE_RE='^AIXMOS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$'
if [ -z "$LICENSE" ]; then
  warn "No license key. Pass --license AIXMOS-XXXX-XXXX-XXXX-XXXX (or set AIXMOS_LICENSE_KEY)."
  $APPLY && die "A valid license key is required for --apply."
elif [[ "$LICENSE" =~ $LICENSE_RE ]]; then
  ok "license format valid"
  if [ -n "${AIXMOS_LICENSE_URL:-}" ]; then
    if curl -sS -m 8 -X POST "$AIXMOS_LICENSE_URL" -H 'Content-Type: application/json' \
         -d "{\"key\":\"$LICENSE\",\"host\":\"$(hostname)\",\"role\":\"$ROLE\"}" >/dev/null 2>&1; then
      ok "license activated against $AIXMOS_LICENSE_URL"
    else warn "activation endpoint unreachable — format ok, will proceed (activate later)"; fi
  else warn "no AIXMOS_LICENSE_URL set — format-checked only (offline)."; fi
else
  die "license key malformed. Expected AIXMOS-XXXX-XXXX-XXXX-XXXX"
fi

# ---- 2. prerequisites
step "Prerequisites"
ensure(){  # ensure <cmd> <brew-pkg> <apt-pkg>
  local cmd="$1" b="$2" a="$3"
  if have "$cmd"; then ok "$cmd present"; return; fi
  warn "$cmd missing"
  case "$PKG" in
    brew) have brew || pipe_install "https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh"; run brew install "$b";;
    apt)  run sudo apt-get update -y; run sudo apt-get install -y "$a";;
    *)    warn "install $cmd manually (no package manager detected).";;
  esac
}
ensure git git git
ensure node node nodejs
ensure curl curl curl
# Ollama (local model server)
if have ollama; then ok "ollama present"; else
  warn "ollama missing"
  if [ "$PLAT" = mac ]; then run brew install ollama || warn "install Ollama from https://ollama.com/download"
  else pipe_install "https://ollama.com/install.sh"; fi
fi

# ---- 3. local model
step "Local model"
if have ollama; then
  run ollama pull "$MODEL"
  $APPLY || echo "  would pull: $MODEL"
else warn "skipping model pull until ollama is installed"; fi

# ---- 4. router config
step "Router (LiteLLM)"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
if [ -f "$ROOT/infra/litellm.config.example.yaml" ]; then
  if [ ! -f "$ROOT/litellm.config.yaml" ]; then
    run cp "$ROOT/infra/litellm.config.example.yaml" "$ROOT/litellm.config.yaml"
    ok "router config staged at litellm.config.yaml (edit tailnet IPs)"
  else ok "litellm.config.yaml already present"; fi
  echo "  start it:  litellm --config litellm.config.yaml --port 4000   (tailnet-only)"
  echo "  then:      export LITELLM_BASE=http://127.0.0.1:4000/v1"
fi

# ---- 5. fact-check gate hook
step "Fact-check gate"
if [ -d "$ROOT/.githooks" ]; then run git -C "$ROOT" config core.hooksPath .githooks; ok "pre-push gate wired"; fi

# ---- 6. self-verify
step "Self-check"
if [ -f "$ROOT/scripts/aixmos.sh" ]; then bash "$ROOT/scripts/aixmos.sh" doctor || true; fi

# ---- 7. role next-steps
step "You're set ($ROLE). Next:"
cat <<NEXT
  • Join Tailscale on this box (same tailnet) so the mesh can reach it.
  • carry  : run the brain hub (Ollama) + LiteLLM; this is CARRY.
  • work   : point LITELLM_BASE at carry's tailnet IP; this is FORGE.
  • brainiac: GPU/vLLM for big models + file tier (BRAIN).
  • Daily:   aixmos brief   |   verify a change:  aixmos verify --apply
  Full guide: docs/QUICKSTART.md  +  docs/OPERATOR-RUNBOOK.md
NEXT
$APPLY && ok "Node setup complete." || warn "DRY-RUN only — re-run with --apply to make changes."
