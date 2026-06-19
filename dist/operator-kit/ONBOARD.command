#!/usr/bin/env bash
# ============================================================
# AIXMOS OPERATOR STATION — onboarding (macOS / Linux). VIP edition.
# Self-contained: installs ONLY the fenced operator toolkit. Never your engine.
# Works offline if the operator-runtime bundle is next to this file (USB/AirDrop),
# otherwise pulls it from your public AIXMOS site. NO private-repo clone.
#   bash ONBOARD.command
# ============================================================
set -uo pipefail
HERE="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
BASE="${AIXMOS_BASE:-https://tmmt-ops.vercel.app}"
DEST="$HOME/AIXMOS-OPERATOR"; PHRASE="I JOIN THE NETWORK"
G=$'\e[32m'; CY=$'\e[36m'; Y=$'\e[33m'; BD=$'\e[1m'; D=$'\e[2m'; X=$'\e[0m'
clear 2>/dev/null || true
printf '%s\n\n' "${CY}${BD}AIXMOS OPERATOR STATION — Powered by PROJECT X AIXMOS${X}"
cat <<'M'
  This sets THIS computer up as a managed AIXMOS operator station. It installs the
  operator toolkit (your one-word commands), registers you as a FENCED operator,
  and prepares you to join the network (the owner approves your device + license).
  It does NOT take passwords, read your files, or hide anything. You can stop now.
M
printf '\n  Type  %s%s%s  to continue: ' "$BD" "$PHRASE" "$X"; IFS= read -r r
[ "$(printf '%s' "$r" | tr '[:lower:]' '[:upper:]' | xargs)" = "$PHRASE" ] || { printf '\n  Cancelled. Nothing changed.\n\n'; exit 0; }
read -p "  First name: " NM; read -p "  Email: " EM

printf '\n%s  Installing the operator toolkit...%s\n' "$BD" "$X"
mkdir -p "$DEST"; tmp="$(mktemp -d)"
if [ -d "$HERE/operator-runtime" ]; then cp -R "$HERE/operator-runtime" "$DEST/"; printf '%s  ✓ installed from this kit (offline)%s\n' "$D" "$X"
elif [ -f "$HERE/operator-runtime.tar.gz" ]; then tar -xzf "$HERE/operator-runtime.tar.gz" -C "$DEST"; printf '%s  ✓ installed from kit bundle%s\n' "$D" "$X"
elif curl -fsSL "$BASE/operator-runtime.tar.gz" -o "$tmp/r.tgz" 2>/dev/null && tar -xzf "$tmp/r.tgz" -C "$DEST" 2>/dev/null; then printf '%s  ✓ installed from %s%s\n' "$D" "$BASE" "$X"
else printf '%s  ✗ could not find the operator toolkit (no bundle here, site unreachable). Ask the owner to re-send the kit.%s\n' "$Y" "$X"; exit 1; fi
RT="$DEST/operator-runtime"; chmod +x "$RT"/* 2>/dev/null || true
mkdir -p "$DEST/.swarm"; echo operator > "$DEST/.swarm/role"; echo "operator-$(printf '%s' "${NM:-op}" | tr '[:upper:] ' '[:lower:]-')" > "$DEST/.swarm/machine"
printf 'AIXMOS_BASE="%s"\nOWNER="PROJECT X AIXMOS"\n' "$BASE" > "$RT/operator.conf"

# one-word commands → the fenced runtime (no engine)
iw(){ local rc="$1" t; t="$(mktemp)"; [ -e "$rc" ] && grep -v 'AIXMOS_WORDS' "$rc" 2>/dev/null > "$t" || true
  { echo "# AIXMOS_WORDS"; for w in menu work guide sync compass watchtower dark; do echo "alias $w='bash \"$RT/$w\"'  # AIXMOS_WORDS"; done
    echo "alias sos='bash \"$RT/sos\"'  # AIXMOS_WORDS"; } >> "$t"; mv "$t" "$rc"; }
touch ~/.zshrc ~/.bashrc 2>/dev/null || true; for rc in ~/.zshrc ~/.bashrc; do iw "$rc"; done
rm -rf "$tmp"

PROF="$HOME/Desktop/AIXMOS-operator-${NM:-op}.txt"; [ -d "$HOME/Desktop" ] || PROF="$HOME/AIXMOS-operator-${NM:-op}.txt"
{ echo "AIXMOS OPERATOR PROFILE"; echo "name: ${NM:-}"; echo "email: ${EM:-}"; echo "machine: $(hostname 2>/dev/null)"; echo "role: operator (fenced)"; echo "status: AWAITING OWNER ACTIVATION"; } > "$PROF"

printf '\n%s  OPERATOR STATION READY (pending activation)%s\n' "$G$BD" "$X"
printf '   1) Send %s back to the owner.\n   2) Owner approves your device + activates your license.\n' "$PROF"
printf '   3) Open a NEW terminal and type: %smenu%s\n\n' "$BD" "$X"
printf '%s   Fenced operator on PROJECT X AIXMOS. Owner holds the keys. Your engine stays VIP.%s\n\n' "$D" "$X"
read -p "  Press ENTER to close." _ 2>/dev/null || true
