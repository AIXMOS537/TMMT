#!/usr/bin/env bash
# Link — owner ↔ operator remote assist across the mesh. Consented, ACL-gated,
# and audited. Built on Tailscale SSH (https://tailscale.com/kb/1193/tailscale-ssh).
# Nothing here is stealth: the operator opts in with `serve`, every assist is a
# heartbeat on the mesh, and Tailscale ACLs decide who can reach whom.
#
# OPERATOR (the TMMT laptop in the field):
#   bash scripts/mesh/link.sh serve              # go assistable (Tailscale up + SSH + announce)
#   bash scripts/mesh/link.sh request "engine won't start, customer waiting"
#
# OWNER / TEAM (you, by their side or remote):
#   bash scripts/mesh/link.sh who                # who's online + their Tailscale address
#   bash scripts/mesh/link.sh assist <machine> [ssh-user]   # SSH in to co-drive
#
# ANY:
#   bash scripts/mesh/link.sh status             # Tailscale + mesh status
set -uo pipefail
source "$(dirname "$0")/../lib/swarm-common.sh"
cd "$SWARM_ROOT"

NOTIFY_ENV="$SWARM_ROOT/scripts/phase9-notify/.env.notify"

have_ts() { command -v tailscale >/dev/null 2>&1; }
ts_hint() {
  warn "Tailscale CLI not found. Install it, then re-run:"
  case "$(swarm_os)" in
    macos)   say "   brew install tailscale   (or the App Store app, then enable the CLI)";;
    linux|wsl) say "   curl -fsSL https://tailscale.com/install.sh | sh";;
    windows) say "   winget install tailscale.tailscale  (then sign in)";;
  esac
}

ping_owner() {
  local msg="$1"
  [[ -f "$NOTIFY_ENV" ]] || { warn "no $NOTIFY_ENV — can't ping the owner (run scripts/phase9-notify/wire-it.sh). Message:"; say "   $msg"; return; }
  set -a; source "$NOTIFY_ENV"; set +a
  local sent=0
  if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    curl -fsS -X POST -H 'Content-type: application/json' \
      --data "$(printf '{"text":%s}' "$(json_str "$msg")")" "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 && sent=1
  fi
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_OWNER_CHAT_ID:-}" ]]; then
    curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TELEGRAM_OWNER_CHAT_ID}" \
      --data-urlencode "text=${msg}" >/dev/null 2>&1 && sent=1
  fi
  [[ $sent -eq 1 ]] && ok "owner pinged" || warn "no channels configured in $NOTIFY_ENV"
}
json_str() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | awk 'BEGIN{printf "\""} {printf "%s", $0} END{printf "\""}'; }

mesh_field() {  # mesh_field <machine> <col#: role=3 tailscale=4 status=5>
  git fetch -q origin "$COORD_BRANCH" 2>/dev/null || true
  git show "origin/$COORD_BRANCH:mesh.tsv" 2>/dev/null \
    | awk -F'\t' -v n="$1" -v c="$2" '$1==n{print $c; exit}'
}

cmd_serve() {
  local me; me="$(swarm_machine)"
  if have_ts; then
    info "bringing Tailscale up with SSH enabled (you may be asked to authenticate)…"
    tailscale up --ssh 2>/dev/null || warn "couldn't run 'tailscale up --ssh' — open the Tailscale app and enable SSH, or run it with sudo"
    ok "Tailscale: $(tailscale_self || echo 'not connected')"
  else
    ts_hint
  fi
  bash "$SWARM_ROOT/scripts/swarm.sh" beat operator assistable >/dev/null 2>&1 \
    && ok "announced '$me' as ASSISTABLE on the mesh" || warn "couldn't announce on the mesh (git write?)"
  say "Owner can now: bash scripts/mesh/link.sh assist $me"
}

cmd_request() {
  local reason="${*:-help needed}"
  local me ts; me="$(swarm_machine)"; ts="$(tailscale_self)"
  bash "$SWARM_ROOT/scripts/swarm.sh" beat operator "NEEDS-HELP" >/dev/null 2>&1 || true
  bash "$SWARM_ROOT/scripts/swarm.sh" add "🆘 HELP [$me${ts:+ @ $ts}]: $reason" >/dev/null 2>&1 || true
  ping_owner "🆘 TMMT help request from ${me}${ts:+ (Tailscale ${ts})}: ${reason}"
  ok "help flag raised on the mesh + owner notified. Stay put — run 'serve' so they can reach you."
}

cmd_who() {
  bash "$SWARM_ROOT/scripts/swarm.sh" mesh
  if have_ts; then say ""; info "Tailscale peers:"; tailscale status 2>/dev/null | sed 's/^/   /' || true; fi
}

cmd_assist() {
  local machine="${1:-}"; [[ -n "$machine" ]] || die "usage: link.sh assist <machine> [ssh-user]"
  local user="${2:-${SSH_ASSIST_USER:-${USER:-$(id -un)}}}"
  local ip; ip="$(mesh_field "$machine" 4)"
  [[ -n "$ip" ]] || die "no Tailscale address recorded for '$machine' — have them run: link.sh serve"
  have_ts || warn "Tailscale CLI not found locally; trying plain ssh to $ip (must be on the tailnet)"
  # Audit: announce the assist on the mesh before connecting.
  bash "$SWARM_ROOT/scripts/swarm.sh" beat "$(swarm_machine_role)" "assisting:$machine" >/dev/null 2>&1 || true
  info "connecting to ${user}@${ip} (Tailscale SSH; ACLs apply)…"
  say "${DIM}On connect you'll land in their shell — cd ~/Projects/TMMT to co-drive.${RST}"
  ssh -o StrictHostKeyChecking=accept-new "${user}@${ip}" -t 'cd ~/Projects/TMMT 2>/dev/null; exec $SHELL -l'
  bash "$SWARM_ROOT/scripts/swarm.sh" beat "$(swarm_machine_role)" online >/dev/null 2>&1 || true
}
# Owner/team default role for audit lines.
swarm_machine_role() { echo "${SWARM_ROLE:-owner}"; }

cmd_status() {
  info "machine: $(swarm_machine) (os: $(swarm_os))  Tailscale: $(tailscale_self || echo 'off')"
  cmd_who
}

case "${1:-status}" in
  serve)   shift; cmd_serve ;;
  request) shift; cmd_request "$@" ;;
  who)     cmd_who ;;
  assist)  shift; cmd_assist "$@" ;;
  status)  cmd_status ;;
  *) die "usage: link.sh [serve | request \"reason\" | who | assist <machine> [user] | status]" ;;
esac
