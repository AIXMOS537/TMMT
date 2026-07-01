#!/usr/bin/env bash
# m1-allin — ONE SHOT, ANYTHING AND EVERYTHING. No prompts. The full ritual:
#   brace (containment) → prove (selftest) → boot (identity, HAILMARY, brain, Pocket,
#   always-on) → read (parity/drift) → ready (fanout) → cockpit → optionally UNLEASH the
#   fleet. Anything needing a credential it doesn't already have is SKIPPED cleanly and
#   listed at the end (rotation/logins stay human — that protects X). Honors DARK + the
#   containment interlock. Idempotent; re-runnable.
#
#   bash scripts/tmmt allin            boot everything safe (no fleet launch)
#   bash scripts/tmmt allin work 3     ...and then put the whole fleet to work (3 agents/node)
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

# parse: "work"/"go"/number → also unleash the fleet at the end
WORK=0; WORK_N=2
for a in "$@"; do case "$a" in work|go|unleash|fleet) WORK=1;; [0-9]*) WORK=1; WORK_N="$a";; esac; done

[ -f "$ROOT/.swarm/DARK" ] && { printf '%s⛔ DARK — one-shot blocked. Lift: bash scripts/godark lift%s\n' "$R" "$X"; exit 1; }

cat <<EOF
${C}${BD}
   ╔══════════════════════════════════════════════════════════╗
   ║   🚀  M1 ALL-IN — ONE SHOT · ANYTHING & EVERYTHING        ║
   ╚══════════════════════════════════════════════════════════╝${X}
   $( [[ "$(uname -s)" == Darwin ]] && echo "macOS detected" || echo "${Y}not macOS — portable subset${X}" )$( [ "$WORK" = 1 ] && echo "   ${BD}+ unleash fleet (${WORK_N}/node)${X}" )
EOF

# ── BRACE: containment interlock (abort on a real leak) ──
step "1  Brace — containment (barn door)"
if [ -x "$ROOT/scripts/containment.sh" ]; then
  bash "$ROOT/scripts/containment.sh" --gate && ok "sealed — no leaks/exposure" \
    || { printf '   %s⛔ containment FAIL — aborting. Run: bash scripts/tmmt barn%s\n' "$R" "$X"; exit 1; }
fi

# ── PROVE: it won't fold ──
step "2  Prove — stress harness"
if bash "$ROOT/scripts/selftest.sh" >/dev/null 2>&1; then ok "selftest held the line"; else warn "selftest flagged something — review: bash scripts/tmmt selftest"; fi

# ── BOOT ──
step "3  Identity + secret-guard hooks"
mkdir -p "$ROOT/.swarm" 2>/dev/null
[ -s "$ROOT/.swarm/machine" ] || (hostname -s 2>/dev/null | tr '[:upper:] ' '[:lower:]-' > "$ROOT/.swarm/machine")
ok "machine id: $(cat "$ROOT/.swarm/machine" 2>/dev/null || echo unknown)"
[ -d "$ROOT/scripts/hooks" ] && git config core.hooksPath scripts/hooks 2>/dev/null && ok "git secret-guard hooks wired"

step "4  Cursor = HAILMARY"
bash "$ROOT/scripts/cursor-hailmary.sh" >/dev/null 2>&1 && ok "persona armed (.cursor/rules/hailmary.mdc)" || warn "verify later: bash scripts/tmmt cursor"

step "5  Local brain (ollama + model)"
bash "$ROOT/scripts/setup-llm.sh" >/dev/null 2>&1 && ok "brain ready" || warn "finish: bash scripts/tmmt brain (ollama may need opening once)"

step "6  Share brain on the mesh"
bash "$ROOT/scripts/setup-llm.sh" serve >/dev/null 2>&1 && ok "brain serving (tailnet/localhost — never public)" || warn "share later: bash scripts/tmmt brain serve"

step "7  Pocket → local brain"
if [ -f "$ROOT/.env" ] && grep -q '^POCKET_BRAIN_URL=' "$ROOT/.env"; then ok "POCKET_BRAIN_URL already set"
else
  { echo "POCKET_BRAIN_URL=http://127.0.0.1:11434/v1/chat/completions"; echo "POCKET_BRAIN_MODEL=qwen2.5:14b"; } >> "$ROOT/.env" 2>/dev/null \
    && ok "Pocket pointed at the local brain (.env)" || warn "couldn't write .env"
  SKIPPED+=("set POCKET_BRAIN_URL in Vercel (prod) — vercel env add POCKET_BRAIN_URL production")
fi

step "8  HAILMARY booyah"
bash "$ROOT/scripts/hailmary" booyah >/dev/null 2>&1 && ok "HAILMARY online (audit + memory + always-on)" || warn "boot later: bash scripts/hailmary booyah"

step "9  Parity / drift (read-only)"
bash "$ROOT/scripts/parity.sh" status >/dev/null 2>&1 && ok "parity status read" || warn "parity status unavailable"
if have supabase && supabase projects list >/dev/null 2>&1; then warn "supabase logged in — end drift: bash scripts/tmmt parity pull (DB password)"
else skip "end the drift: supabase login → bash scripts/tmmt parity pull (DB password)"; fi

step "10  Fanout readiness"
if have tailscale && tailscale status >/dev/null 2>&1; then ok "Tailscale up — node reachable on the mesh"; warn "enable SSH once for remote launch: tailscale up --ssh"
else skip "join the mesh: bash scripts/tmmt serve (Tailscale + SSH) for fanout reach"; fi

step "11  Security — open items"
skip "ROTATE the leaked key, then push clears — docs/security/GITLEAKS-PUSH-BLOCKED.md"

# ── COCKPIT ──
step "12  Cockpit"
bash "$ROOT/scripts/ceo" brief >/dev/null 2>&1 && bash "$ROOT/scripts/ceo" brief 2>/dev/null || bash "$ROOT/scripts/ceo" 2>/dev/null || true

# ── UNLEASH (optional) ──
if [ "$WORK" = 1 ]; then
  step "13  Unleash the fleet (${WORK_N}/node)"
  bash "$ROOT/scripts/fanout.sh" "$WORK_N" || warn "fanout returned non-zero (see above)"
fi

cat <<EOF

${G}${BD}   ONE SHOT COMPLETE — everything safe is done, with no prompts.${X}
EOF
if [ "${#SKIPPED[@]}" -gt 0 ]; then
  printf '%s   REMAINING — credential-gated (human-only, on purpose):%s\n' "$BD" "$X"
  for s in "${SKIPPED[@]}"; do printf '     • %s\n' "$s"; done
  printf '   %sThese stay human because they hold your keys — that boundary protects X.%s\n' "$Y" "$X"
else ok "nothing left — fully set."; fi
printf '\n   You: %sbash scripts/tmmt ceo%s   ·   Proof: %stmmt barn%s + %stmmt selftest%s   ·   Work: %stmmt allin work 3%s\n' "$BD" "$X" "$BD" "$X" "$BD" "$X" "$BD" "$X"
