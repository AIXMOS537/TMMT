#!/usr/bin/env bash
# install-oneshot-bin.sh — one-word commands → ~/.local/bin
set -euo pipefail
BIN="$HOME/.local/bin"
mkdir -p "$BIN"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for d in "$HOME/Projects/TMMT" "$HOME/projects/TMMT" "$HOME/TMMT"; do
  [[ -f "$d/scripts/tmmt" ]] && { ROOT="$d"; break; }
done

wrap() {
  local name="$1" rel="$2"
  [[ -f "$ROOT/$rel" ]] || return 0
  cat > "$BIN/$name" <<WRAP
#!/usr/bin/env bash
set -euo pipefail
for d in "\$HOME/Projects/TMMT" "\$HOME/projects/TMMT" "\$HOME/TMMT"; do
  [[ -f "\$d/$rel" ]] && exec bash "\$d/$rel" "\$@"
done
echo "✗ TMMT/$rel not found — run: bash scripts/lib/mesh-plate-restore.sh" >&2
exit 1
WRAP
  chmod +x "$BIN/$name"
}

wrap oneshot scripts/one-shot.sh
wrap one-shot scripts/one-shot.sh
wrap order scripts/serve.sh
wrap serve scripts/serve.sh
wrap x scripts/x
wrap booyah scripts/booyah.sh
wrap fleet-up scripts/fleet-up.sh
wrap m1-door scripts/m1-door.sh
wrap brainiac-ctl scripts/mesh/brainiac-ctl.sh
wrap rick-send scripts/mesh/rick-send.sh
wrap office-up-rick scripts/office-up-rick.sh
wrap handoff scripts/mesh-handoff.sh
[[ -f "$ROOT/scripts/tmmt" ]] && wrap tmmt scripts/tmmt
[[ -f "$ROOT/scripts/go" ]] && wrap go scripts/go
[[ -f "$ROOT/scripts/menu" ]] && wrap menu scripts/menu
echo "✓ ~/.local/bin → order · x · booyah · fleet-up · handoff"
