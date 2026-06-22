#!/usr/bin/env bash
# m1-allin — ONE SHOT, NO PROMPTS. Runs every SAFE setup step on the M1 automatically:
#   identity+hooks · Cursor=HAILMARY · local brain (+share on mesh) · point Pocket at it
#   · HAILMARY booyah (self-audit/always-on) · parity/drift read · fanout readiness · cockpit
#
# It NEVER prompts. Anything that needs a credential it doesn't already have is SKIPPED
# cleanly and listed at the end — rotation / logins are human-gated ON PURPOSE (that
# protects X). Honors the DARK kill-switch. Idempotent; re-runnable.
#
#   bash scripts/m1-allin.sh            # or: bash scripts/tmmt allin
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT" || exit 1
export HOMEBREW_NO_AUTO_UPDATE=1 PIP_DISABLE_PIP_VERSION_CHECK=1
if [[ -t 1 ]]; then G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; BD=$'\e[1m'; X=$'\e[0m'; else G=; Y=; R=; C=; BD=; X=; fi
SKIPPED=()
step(){ printf '\n%s▶ %s%s\n' "$BD" "$*" "$X"; }
ok(){ printf '   %s✓ %s%s\n' "$G" "$*" "$X"; }
warn(){ printf '   %s• %s%s\n' "$Y" "$*" "$X"; }
skip(){ SKIPPED+=("$1"); printf '   %s↪ skipped (needs you): %s%s\n' "$Y" "$1" "$X"; }
have(){ command -v "$1" >/dev/null 2>&1; }
run(){ "$@" >/dev/null 2>&1 && return 0 || return 1; }   # swallow, keep going

[ -f "$ROOT/.swarm/DARK" ] && { printf '%s⛔ DARK — one-shot blocked. Lift: bash scripts/godark lift%s\n' "$R" "$X"; exit 1; }

cat <<EOF
${C}${BD}
   ╔══════════════════════════════════════════════════════════╗
   ║   🚀  M1 ALL-IN — ONE SHOT · NO PROMPTS                   ║
   ╚══════════════════════════════════════════════════════════╝${X}
   $( [[ "$(uname -s)" == Darwin ]] && echo "macOS detected" || echo "${Y}not macOS — running the portable subset${X}" )
EOF

# 0) BARN DOOR — containment interlock before any power flows
step "0/9  Containment (barn door)"
if [ -x "$ROOT/scripts/containment.sh" ]; then
  bash "$ROOT/scripts/containment.sh" --gate && ok "sealed — no leaks/exposure" \
    || { printf '   %s⛔ containment FAIL — aborting. Run: bash scripts/tmmt barn%s\n' "$R" "$X"; exit 1; }
fi

# 1) machine identity + secret-guard hooks (non-interactive equivalents of swarm-join)
step "1/9  Identity + secret-guard hooks"
mkdir -p "$ROOT/.swarm" 2>/dev/null
[ -s "$ROOT/.swarm/machine" ] || (hostname -s 2>/dev/null | tr '[:upper:] ' '[:lower:]-' > "$ROOT/.swarm/machine")
ok "machine id: $(cat "$ROOT/.swarm/machine" 2>/dev/null || echo unknown)"
if [ -d "$ROOT/scripts/hooks" ]; then git config core.hooksPath scripts/hooks 2>/dev/null && ok "git secret-guard hooks wired"; fi

# 2) Cursor = HAILMARY (read-only arm/verify)
step "2/9  Cursor = HAILMARY"
run bash "$ROOT/scripts/cursor-hailmary.sh" && ok "persona armed (.cursor/rules/hailmary.mdc)" || warn "verify later: bash scripts/tmmt cursor"

# 3) local brain (install + model, non-interactive)
step "3/9  Local brain (ollama + model)"
run bash "$ROOT/scripts/setup-llm.sh" && ok "general brain ready" || warn "finish brain: bash scripts/tmmt brain (may need ollama app opened once)"

# 4) share the brain on the mesh
step "4/9  Share brain on the mesh"
run bash "$ROOT/scripts/setup-llm.sh" serve && ok "brain serving on the tailnet (11434)" || warn "share later: bash scripts/tmmt brain serve"

# 5) point Pocket at the local brain — autonomous on (local .env only; gitignored)
step "5/9  Pocket → local brain"
if [ -f "$ROOT/.env" ] && grep -q '^POCKET_BRAIN_URL=' "$ROOT/.env"; then
  ok "POCKET_BRAIN_URL already set (left as-is)"
else
  { echo "POCKET_BRAIN_URL=http://127.0.0.1:11434/v1/chat/completions"
    echo "POCKET_BRAIN_MODEL=qwen2.5:14b"; } >> "$ROOT/.env" 2>/dev/null \
    && ok "Pocket pointed at the local brain (.env)" || warn "couldn't write .env"
  warn "for PROD Pocket, set POCKET_BRAIN_URL in Vercel too"
  SKIPPED+=("set POCKET_BRAIN_URL in Vercel (prod) — vercel env add POCKET_BRAIN_URL production")
fi

# 6) HAILMARY booyah — self-audit + absorb + always-on
step "6/9  HAILMARY booyah"
run bash "$ROOT/scripts/hailmary" booyah && ok "HAILMARY online (self-audit + memory + always-on)" || warn "boot later: bash scripts/hailmary booyah"

# 7) parity / drift — READ only (setup needs the DB password → human-gated)
step "7/9  Parity / drift (read-only)"
run bash "$ROOT/scripts/parity.sh" status && ok "parity status read" || warn "parity status unavailable"
if have supabase && supabase projects list >/dev/null 2>&1; then
  warn "supabase: logged in — finish drift with: bash scripts/tmmt parity pull (needs DB password)"
else
  skip "end the drift: supabase login → bash scripts/tmmt parity pull (DB password)"
fi

# 8) fanout readiness (Tailscale SSH enables remote agent launch)
step "8/9  Fanout readiness"
if have tailscale && tailscale status >/dev/null 2>&1; then
  ok "Tailscale up — this node is reachable on the mesh"
  warn "to let fanout LAUNCH agents here, enable SSH once: tailscale up --ssh (may prompt)"
else
  skip "join the mesh: bash scripts/tmmt serve (Tailscale + SSH) — needed for fanout reach"
fi

# 9) the open security item — gitleaks block (rotation is human-only, by design)
step "9/9  Security: open items"
skip "ROTATE the leaked key on the dashboard, then push clears — docs/security/GITLEAKS-PUSH-BLOCKED.md"

# ── the cockpit ─────────────────────────────────────────────────────────────
step "Cockpit"
run bash "$ROOT/scripts/ceo" brief || bash "$ROOT/scripts/ceo" 2>/dev/null || true

cat <<EOF

${G}${BD}   ONE SHOT COMPLETE — everything safe is done, with no prompts.${X}
EOF
if [ "${#SKIPPED[@]}" -gt 0 ]; then
  printf '%s   REMAINING — credential-gated (human-only, on purpose):%s\n' "$BD" "$X"
  for s in "${SKIPPED[@]}"; do printf '     • %s\n' "$s"; done
  printf '   %sThese stay human because they hold your keys — that boundary protects X.%s\n' "$Y" "$X"
else
  ok "nothing left — fully set."
fi
printf '\n   You: %sbash scripts/tmmt ceo%s   ·   Fleet: %sbash scripts/tmmt fanout 3%s\n' "$BD" "$X" "$BD" "$X"
