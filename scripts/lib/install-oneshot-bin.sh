#!/usr/bin/env bash
# install-oneshot-bin.sh — global ~/.local/bin wrappers (one word, any directory).
set -euo pipefail

LIB="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=repo-root.sh
. "$LIB/repo-root.sh"
[ -n "${TMMT_REPO:-}" ] || { echo "✗ TMMT repo not found — clone to ~/Projects/TMMT"; exit 1; }

BIN="$HOME/.local/bin"
mkdir -p "$BIN"

wrap() {
  local name="$1" target="$2"
  cat > "$BIN/$name" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec bash "$target" "\$@"
EOF
  chmod +x "$BIN/$name"
}

wrap garage "$TMMT_REPO/scripts/garage"
[ -x "$TMMT_REPO/scripts/overhaul-deploy.sh" ] && wrap overhaul "$TMMT_REPO/scripts/overhaul-deploy.sh"
wrap tmmt  "$TMMT_REPO/scripts/tmmt"
wrap base  "$TMMT_REPO/scripts/go"
wrap booyah "$TMMT_REPO/scripts/hailmary"
# booyah must invoke the boot sequence, not show help
cat > "$BIN/booyah" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec bash "$TMMT_REPO/scripts/hailmary" booyah "\$@"
EOF
chmod +x "$BIN/booyah"
wrap hailmary "$TMMT_REPO/bin/hailmary"

for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
  [ -e "$rc" ] || touch "$rc"
  if ! grep -q 'TMMT_LOCAL_BIN' "$rc" 2>/dev/null; then
    cat >> "$rc" <<'RC'

# TMMT_LOCAL_BIN — one-shot commands from anywhere
export PATH="$HOME/.local/bin:$PATH"
RC
  fi
done

echo "✓ one-shot bins → $BIN (garage tmmt base booyah hailmary)"
