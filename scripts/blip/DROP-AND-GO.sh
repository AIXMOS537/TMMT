#!/usr/bin/env bash
# DROP-AND-GO.sh — ONE command after BLIP / AirDrop / USB / Bluetooth file share.
# Mac: double-click GO.command · Windows: double-click GO.bat
#
#   bash DROP-AND-GO.sh                  # auto-detect role + tier
#   bash DROP-AND-GO.sh carry            # owner carry Mac
#   bash DROP-AND-GO.sh forge            # build/deploy Mac / office PC
#   bash DROP-AND-GO.sh brain            # Brainiac Windows PC
#   bash DROP-AND-GO.sh ops              # closer/setter laptop
#   bash DROP-AND-GO.sh rick             # Rick M1 Max (Syncthing fleet)
#
# Office security: employee PCs lock by default (no master keys).
# Owner: bash scripts/blip/office-mode.sh unlock|broadcast
set -uo pipefail

ROLE="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
# Non-interactive: BLIP_ROLE=carry bash DROP-AND-GO.sh
[[ -z "$ROLE" && -n "${BLIP_ROLE:-}" ]] && ROLE="$BLIP_ROLE"

# Auto-detect role from hostname if not passed
if [[ -z "$ROLE" && -x "$SCRIPT_DIR/scripts/blip/detect-device.sh" ]]; then
  # shellcheck disable=SC1090
  eval "$("$SCRIPT_DIR/scripts/blip/detect-device.sh")"
  ROLE="${BLIP_ROLE:-}"
elif [[ -z "$ROLE" && -x "$SCRIPT_DIR/detect-device.sh" ]]; then
  eval "$("$SCRIPT_DIR/detect-device.sh")"
  ROLE="${BLIP_ROLE:-}"
fi
# Bundle may live on USB: find TMMT (script lives in repo/scripts/blip or BLIP folder root)
find_tmmt() {
  for d in \
    "$SCRIPT_DIR/../.." \
    "$SCRIPT_DIR/.." \
    "$HOME/projects/TMMT" "$HOME/Projects/TMMT" "$HOME/TMMT" \
    "/Volumes/BLIP/TMMT" "/Volumes/USB/TMMT" "/Volumes/AI-OPS/TMMT"; do
    [[ -f "$d/scripts/tmmt" ]] && { echo "$d"; return 0; }
  done
  return 1
}

say() { printf '%s\n' "$*"; }
ok()  { say "✓ $*"; }
warn(){ say "⚠ $*"; }

pick_role() {
  say ""
  say "Pick this device's role (one letter):"
  say "  c = carry  (owner field Mac)"
  say "  f = forge  (build + deploy Mac)"
  say "  b = brain  (Brainiac Windows PC)"
  say "  o = ops    (closers/setters)"
  say "  r = rick   (M1 Max agent fleet)"
  read -r pick || true
  case "${pick:-}" in
    c|carry) ROLE=carry ;;
    f|forge) ROLE=forge ;;
    b|brain) ROLE=brain ;;
    o|ops)   ROLE=ops ;;
    r|rick)  ROLE=rick ;;
    *) ROLE=all ;;
  esac
}

[[ -n "$ROLE" ]] || pick_role
case "$ROLE" in
  carry|owner) ROLE=carry ;;
  forge|m1|build) ROLE=forge ;;
  brain|brainiac|windows) ROLE=brain ;;
  ops|closer|setter) ROLE=ops ;;
  rick|m1-max) ROLE=rick ;;
esac

say ""
say "═══════════════════════════════════════════"
say "  BLIP DROP-AND-GO  ·  role: $ROLE"
say "═══════════════════════════════════════════"

ROOT=""
if ROOT="$(find_tmmt)"; then
  ok "TMMT found: $ROOT"
else
  warn "TMMT not found — cloning..."
  mkdir -p "$HOME/projects"
  git clone https://github.com/AIXMOS537/TMMT.git "$HOME/projects/TMMT" \
    && ROOT="$HOME/projects/TMMT" \
    || { say "✗ clone failed — need network + GitHub access"; exit 1; }
fi
cd "$ROOT"
export TMMT_ROOT="$ROOT"
export PATH="$HOME/.local/bin:$PATH"

# Machine name
ME="$(hostname -s 2>/dev/null | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9-' || echo device)"
[[ ! -f "$ROOT/.swarm/machine" ]] && bash "$ROOT/scripts/swarm-join.sh" --name "$ME" 2>/dev/null || true
printf '%s\n' "$ROLE" > "$ROOT/.swarm/role" 2>/dev/null || mkdir -p "$ROOT/.swarm" && printf '%s\n' "$ROLE" > "$ROOT/.swarm/role"

# Office mode — lock employees, unlock owner (HAILMARY sovereign)
OFFICE_SH="$ROOT/scripts/blip/office-mode.sh"
[[ -x "$SCRIPT_DIR/scripts/blip/office-mode.sh" ]] && OFFICE_SH="$SCRIPT_DIR/scripts/blip/office-mode.sh"
if [[ -f "$OFFICE_SH" ]]; then
  case "$ROLE" in
    carry|rick|brain)
      bash "$OFFICE_SH" unlock 2>/dev/null || bash "$OFFICE_SH" poll 2>/dev/null || true
      ;;
    *)
      bash "$OFFICE_SH" poll 2>/dev/null || bash "$OFFICE_SH" lock 2>/dev/null || true
      ;;
  esac
fi

# X-FOREVER forge stack (1:1 parity on every Mac)
for XF in "$SCRIPT_DIR/X-FOREVER/RUN-X-FOREVER.sh" "$HOME/Desktop/X-FOREVER/RUN-X-FOREVER.sh"; do
  [[ -f "$XF" ]] && { bash "$XF" >/dev/null 2>&1 && ok "X-FOREVER stack" || true; break; }
done

# One-word commands: oneshot · tmmt · watchtower · booyah · fleet-up · apex
bash "$ROOT/scripts/lib/install-oneshot-bin.sh" 2>/dev/null || true
bash "$ROOT/scripts/fleet-up.sh" 2>/dev/null || true
bash "$ROOT/scripts/apex.sh" up 2>/dev/null || true

# Mesh plate from bundle (if dropped from BLIP pack)
[[ -x "$SCRIPT_DIR/../lib/mesh-plate-restore.sh" ]] && bash "$SCRIPT_DIR/../lib/mesh-plate-restore.sh" 2>/dev/null || true
[[ -x "$ROOT/scripts/lib/mesh-plate-restore.sh" ]] && bash "$ROOT/scripts/lib/mesh-plate-restore.sh" 2>/dev/null || true

# Regenerate AI one-shot + role boot
bash "$ROOT/scripts/oneshot-generate.sh" 2>/dev/null || true
bash "$ROOT/scripts/mesh/go-live-device.sh" --role "$ROLE" 2>/dev/null || true
bash "$ROOT/scripts/apex.sh" up 2>/dev/null || bash "$ROOT/scripts/forever-up.sh" "$ROLE" 2>/dev/null || true

# Rick + Brain hooks
case "$ROLE" in
  rick)
  say "Rick fleet — installing M1 scripts from drop bundle"
  mkdir -p "$HOME/Sync/rick/M1-SCRIPTS" "$HOME/Sync/rick/FLEET-INBOX/done"
  for SRC in "$SCRIPT_DIR/rick/M1-SCRIPTS" "$SCRIPT_DIR/M1-SCRIPTS"; do
    [[ -d "$SRC" ]] && cp -f "$SRC/"*.sh "$HOME/Sync/rick/M1-SCRIPTS/" 2>/dev/null && break
  done
  chmod +x "$HOME/Sync/rick/M1-SCRIPTS/"*.sh 2>/dev/null || true
  if [[ -x "$SCRIPT_DIR/rick/oneshot-install.sh" ]]; then
    bash "$SCRIPT_DIR/rick/oneshot-install.sh" 2>/dev/null || true
  elif [[ -x "$SCRIPT_DIR/rick/RUN-M1-FIX-ONCE.sh" ]]; then
    bash "$SCRIPT_DIR/rick/RUN-M1-FIX-ONCE.sh" 2>/dev/null || true
  elif [[ -x "$HOME/Sync/rick/RUN-M1-FIX-ONCE.sh" ]]; then
    bash "$HOME/Sync/rick/RUN-M1-FIX-ONCE.sh" 2>/dev/null || true
  fi
  [[ -x "$HOME/Sync/rick/M1-SCRIPTS/brainiac-via-m1.sh" ]] \
    && bash "$HOME/Sync/rick/M1-SCRIPTS/brainiac-via-m1.sh" 2>/dev/null || true
  say "Rick fleet: missions auto-run from ~/Sync/rick/FLEET-INBOX/"
  say "  Drop work: echo '# task' >> ~/Sync/rick/FLEET-INBOX/mission-\$(date +%s).md"
    ;;
  brain)
    say "Brainiac: start AI-OPS-STARTER stack on this PC"
    for OPS in "$HOME/projects/AI-OPS-STARTER" "$HOME/AI-OPS-STARTER" "C:/AI-OPS-STARTER"; do
      [[ -d "$OPS" ]] && { say "  cd $OPS && docker compose up -d"; break; }
    done
    say "  memory vault: set HAILMARY_VAULT to Obsidian path, then: bash scripts/tmmt memory once"
    ;;
  carry)
    bash "$ROOT/scripts/mesh/unison.sh" status 2>/dev/null || true
    ;;
esac

bash "$ROOT/scripts/tmmt" sync 2>/dev/null || bash "$ROOT/scripts/sync-machine.sh" 2>/dev/null || true

say ""
say "═══════════════════════════════════════════"
say "  DROP COMPLETE"
say "═══════════════════════════════════════════"
say "Paste into Claude/Cursor (any AI):"
say "  cat $ROOT/docs/ONE-SHOT-AI.md"
say ""
say "Owner command center:"
say "  watchtower"
say ""
say "Daily sync (all devices):"
say "  tmmt sync"
say ""
say "Integration test (after deploy):"
say "  bash scripts/mesh/go-live-integration-test.sh"
say ""
say "Notify policy: agents log to watchtower; owner pinged URGENT/EMERGENCY only."
say "  config/notify-policy.json"
say ""
say "Office mode (employee protection):"
say "  bash scripts/blip/office-mode.sh status"
say "  Owner unlock:  bash scripts/blip/office-mode.sh unlock"
say "  Lock employees: bash scripts/blip/office-mode.sh lock"
say "  Unlock ALL from Carry: bash scripts/blip/office-mode.sh broadcast"
