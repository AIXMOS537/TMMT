#!/usr/bin/env bash
#
# brain-backup.sh — nightly gzipped pg_dump of the LOCAL HAILMARY brain to the
# NAS (reached over Tailscale). Keeps the brain on THIS box; the NAS only holds
# encrypted-at-rest dump copies. Safe + idempotent; prunes dumps older than 30d.
#
# Usage:  bash scripts/brain-backup.sh [/path/to/nas/dir]
# NAS dir resolution order: $1  ->  $BRAIN_BACKUP_DIR  ->  brain.env BRAIN_BACKUP_DIR
set -uo pipefail

ENVF="$HOME/.hailmary/brain.env"
# shellcheck disable=SC1090
[ -f "$ENVF" ] && . "$ENVF"

NAS_DIR="${1:-${BRAIN_BACKUP_DIR:-}}"
CONTAINER="hailmary-brain-db"
DB="${BRAIN_PG_DB:-hailmary_brain}"
USER_PG="${BRAIN_PG_USER:-hailmary}"

if [ -z "$NAS_DIR" ]; then
  echo "No NAS path set. Pass it as arg or set BRAIN_BACKUP_DIR in $ENVF." >&2
  exit 2
fi
if [ ! -d "$NAS_DIR" ]; then
  echo "NAS path not mounted/reachable: $NAS_DIR (is the NAS up on Tailscale?)" >&2
  exit 3
fi

TS="$(date +%Y%m%d-%H%M%S)"
OUT="$NAS_DIR/hailmary_brain_${TS}.sql.gz"
TMP="${OUT}.partial"

if docker exec "$CONTAINER" pg_dump -U "$USER_PG" "$DB" | gzip -9 > "$TMP"; then
  mv "$TMP" "$OUT"
  echo "$(date '+%F %T') backup OK -> $OUT ($(du -h "$OUT" | cut -f1))"
  # keep 30 days
  find "$NAS_DIR" -name 'hailmary_brain_*.sql.gz' -type f -mtime +30 -delete 2>/dev/null || true
else
  rm -f "$TMP"
  echo "$(date '+%F %T') backup FAILED" >&2
  exit 1
fi
