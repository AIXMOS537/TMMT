#!/usr/bin/env bash
# fleet-ready — make THIS machine "wake-up ready": reachable from the carry Mac over
# Tailscale, role-aware, and self-tending. Run once per device (owner-only, local-first).
# So you open the carry Mac in the morning, `tmmt remote`, and the fleet's already up.
#
#   bash scripts/fleet-ready.sh [brain|carry|worker|auto]   arm this device
#   bash scripts/fleet-ready.sh plan                        show what each role does (safe)
#   bash scripts/tmmt ready
#
# Honors DARK + containment. Credential/persistence steps (tailscale auth, always-on)
# run on the real machine; here they degrade cleanly. Never touches prod or secrets.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT" || exit 1
if [[ -t 1 ]]; then G=$'\e[32m'; Y=$'\e[33m'; C=$'\e[36m'; BD=$'\e[1m'; X=$'\e[0m'; else G=; Y=; C=; BD=; X=; fi
ok(){ printf '   %s✓ %s%s\n' "$G" "$*" "$X"; }
warn(){ printf '   %s• %s%s\n' "$Y" "$*" "$X"; }
step(){ printf '\n%s▶ %s%s\n' "$BD" "$*" "$X"; }
have(){ command -v "$1" >/dev/null 2>&1; }
run(){ bash "$@" >/dev/null 2>&1; }

os_kind(){ case "$(uname -s)" in Darwin) echo macos;; Linux) grep -qiE microsoft /proc/version 2>/dev/null && echo wsl || echo linux;; *) echo windows;; esac; }
machine(){ cat "$ROOT/.swarm/machine" 2>/dev/null || hostname -s 2>/dev/null | tr '[:upper:] ' '[:lower:]-'; }

# role: arg → infer from machine name → default worker
ARG="${1:-auto}"
infer_role(){ case "$(machine)" in *brainiac-mac*|*brain*) echo brain;; *carry*) echo carry;; *) echo worker;; esac; }
ROLE="$ARG"; [ "$ARG" = auto ] && ROLE="$(infer_role)"

if [ "$ARG" = plan ]; then
cat <<EOF
${BD}fleet-ready roles (run once per device):${X}
  ${C}brain${X}  (M1 brainiac-mac)  → tmmt allin · always-on · autopilot install · serve(SSH)
                                  the always-on body the carry Mac talks to.
  ${C}carry${X} (carry Mac)         → cursor=HAILMARY · serve(SSH) · NOT always-on
                                  your mobile command; sleeps with you.
  ${C}worker${X}(Windows/WSL/Mac)   → swarm-join · brain --coder · autopilot · serve(SSH)
                                  a fanout target; runs agents.
${Y}Note:${X} macOS in a VM on Windows breaks Apple's EULA — run Windows boxes as
  WSL/Linux ${BD}worker${X} nodes (fully supported by the mesh). macOS VMs → Apple silicon only.
EOF
exit 0
fi

[ -f "$ROOT/.swarm/DARK" ] && { echo "⛔ DARK — fleet-ready paused. Lift: bash scripts/godark lift"; exit 1; }
[ -x "$ROOT/scripts/containment.sh" ] && { bash "$ROOT/scripts/containment.sh" --gate || { echo "⛔ containment FAIL — fix first: tmmt barn"; exit 1; }; }

OS="$(os_kind)"
printf '%s🌅 FLEET-READY · %s · role=%s · os=%s%s\n' "$BD" "$(machine)" "$ROLE" "$OS" "$X"

# ── common: identity + reachability (so the carry Mac can remote in) ──
step "Mesh identity"
mkdir -p "$ROOT/.swarm"; [ -s "$ROOT/.swarm/machine" ] || (hostname -s 2>/dev/null | tr '[:upper:] ' '[:lower:]-' > "$ROOT/.swarm/machine"); ok "id: $(machine)"
[ -x "$ROOT/scripts/swarm-join.sh" ] && { run "$ROOT/scripts/swarm-join.sh" && ok "swarm-join done" || warn "run later: bash scripts/swarm-join.sh"; }

step "Reachable over Tailscale (so the carry Mac can remote in)"
if have tailscale; then
  tailscale up --ssh >/dev/null 2>&1 && ok "Tailscale up + SSH enabled" || warn "approve once: tailscale up --ssh (browser auth)"
  bash "$ROOT/scripts/mesh/link.sh" serve >/dev/null 2>&1 && ok "announced on the mesh" || true
else warn "install Tailscale, then: bash scripts/tmmt serve"; fi

# ── role-specific ──
case "$ROLE" in
  brain)
    step "Brain (always-on body the carry Mac talks to)"
    run "$ROOT/scripts/m1-allin.sh" && ok "allin: booted everything safe" || warn "run: bash scripts/tmmt allin"
    [ "$OS" = macos ] && { bash "$ROOT/scripts/tmmt" always owner 180 >/dev/null 2>&1 && ok "always-on installed" || warn "always-on: bash scripts/tmmt always"; }
    run "$ROOT/scripts/autopilot.sh" install && ok "autopilot scheduled" || warn "autopilot: bash scripts/tmmt autopilot install"
    ;;
  carry)
    step "Carry (mobile command — not always-on)"
    run "$ROOT/scripts/cursor-hailmary.sh" && ok "Cursor=HAILMARY armed" || warn "verify: bash scripts/tmmt cursor"
    ok "use it in the morning: bash scripts/tmmt remote   (→ remote into the M1)"
    ;;
  worker)
    step "Worker (fanout target — runs agents)"
    run "$ROOT/scripts/setup-llm.sh" --coder && ok "coder brain ready" || warn "brain: bash scripts/tmmt brain --coder"
    run "$ROOT/scripts/autopilot.sh" install && ok "autopilot scheduled" || warn "autopilot: bash scripts/tmmt autopilot install"
    ok "the owner can now: bash scripts/tmmt fanout N  (summons this node)"
    ;;
  *) warn "unknown role '$ROLE' — use: brain | carry | worker";;
esac

cat <<EOF

${G}${BD}🌅 READY.${X}  ${BD}$(machine)${X} is reachable + role-armed.
   Morning flow:  open carry Mac → ${BD}bash scripts/tmmt remote${X}  (remote into the M1)
   Whole fleet:   ${BD}bash scripts/tmmt fanout 3${X}     cockpit: ${BD}bash scripts/tmmt ceo${X}
EOF
