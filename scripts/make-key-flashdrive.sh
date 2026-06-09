#!/usr/bin/env bash
# Prepare a "key" flashdrive — copies this repo's working .env onto the drive so
# it can bootstrap an owner machine (carry Mac, etc.) via bootstrap-carry-mac.sh.
#
# Run this on a machine that ALREADY has a working .env. The resulting drive holds
# live secrets — it is a KEY. Keep it physically secure. NEVER prepare an
# operator's drive this way (operator kits carry zero secrets).
#
# Usage:
#   bash scripts/make-key-flashdrive.sh /Volumes/YOUR-KEY

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VOL="${1:-}"

[[ -n "$VOL" ]]   || { echo "Usage: bash scripts/make-key-flashdrive.sh /Volumes/YOUR-KEY"; exit 1; }
[[ -d "$VOL" ]]   || { echo "✗ $VOL is not mounted."; exit 1; }
[[ -f "$ROOT/.env" ]] || { echo "✗ No .env in the repo to copy. Set up .env first (cp .env.example .env and fill it)."; exit 1; }

mkdir -p "$VOL/secrets"
cp "$ROOT/.env" "$VOL/secrets/.env"
chmod 600 "$VOL/secrets/.env" 2>/dev/null || true

echo "🔑  Wrote $VOL/secrets/.env"
echo "    This drive is now a KEY — keep it physically secure."
echo "    On another owner machine: clone the repo, then run"
echo "      bash scripts/bootstrap-carry-mac.sh \"$VOL\""
