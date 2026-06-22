#!/usr/bin/env bash
#
# seal-brain-local.sh — stand up the brain LOCAL on this box: local Postgres +
# pgvector (the brain DB), Ollama + models (local AI), and lock access to the
# Tailscale mesh only. No cloud, no outside access.
#
# SAFE: dry-run by default (prints the plan); --apply does it. Idempotent.
# Generates strong secrets into ~/.hailmary/brain.env (chmod 600).
#
# Usage:
#   bash scripts/seal-brain-local.sh            # show the plan
#   bash scripts/seal-brain-local.sh --apply
set -uo pipefail

APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
ENVF="$HOME/.hailmary/brain.env"
PGDATA_VOL="hailmary_brain_pgdata"
PG_CONTAINER="hailmary-brain-db"
PG_PORT="${BRAIN_PG_PORT:-5432}"
OLLAMA_MODELS=("qwen2.5:14b" "nomic-embed-text")

say(){ printf '\033[1;36m▸ %s\033[0m\n' "$*"; }
warn(){ printf '\033[1;33m! %s\033[0m\n' "$*"; }

echo "=== Seal the brain LOCAL (apply=$([ $APPLY = 1 ] && echo YES || echo no)) ==="
echo "Plan:"
echo "  1. Ensure Docker + Ollama installed."
echo "  2. Local brain DB: Postgres 16 + pgvector in Docker ('$PG_CONTAINER', port $PG_PORT, volume $PGDATA_VOL)."
echo "  3. Pull local models: ${OLLAMA_MODELS[*]}."
echo "  4. Write ~/.hailmary/brain.env (strong random secrets, chmod 600)."
echo "  5. Print Tailscale-only + ACL lock steps (no public exposure)."
echo

if [ "$APPLY" != "1" ]; then
  echo "Dry run. To do it:  bash scripts/seal-brain-local.sh --apply"
  exit 0
fi

# 1. Docker + Ollama
command -v docker >/dev/null 2>&1 || { warn "Docker not found — install Docker Desktop / docker engine, then re-run."; exit 1; }
command -v ollama >/dev/null 2>&1 || { say "Installing Ollama…"; curl -fsSL https://ollama.com/install.sh | sh || warn "install Ollama manually"; }
(ollama serve >/dev/null 2>&1 &) ; sleep 2

# 4. secrets first (idempotent: keep existing if present)
mkdir -p "$HOME/.hailmary"
if [ ! -f "$ENVF" ]; then
  PGPASS="$(openssl rand -hex 24)"
  cat > "$ENVF" <<EOF
# Local brain secrets — generated $(date). Keep private.
BRAIN_PG_HOST=127.0.0.1
BRAIN_PG_PORT=$PG_PORT
BRAIN_PG_DB=hailmary_brain
BRAIN_PG_USER=hailmary
BRAIN_PG_PASSWORD=$PGPASS
BRAIN_DATABASE_URL=postgresql://hailmary:$PGPASS@127.0.0.1:$PG_PORT/hailmary_brain
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:14b
EOF
  chmod 600 "$ENVF"
  say "Wrote $ENVF (chmod 600)"
else
  warn "$ENVF exists — keeping existing secrets."
fi
# shellcheck disable=SC1090
. "$ENVF"

# 2. local Postgres + pgvector
if docker ps -a --format '{{.Names}}' | grep -q "^${PG_CONTAINER}$"; then
  say "Brain DB container exists — starting it."; docker start "$PG_CONTAINER" >/dev/null || true
else
  say "Creating local brain DB (pgvector)…"
  docker run -d --name "$PG_CONTAINER" --restart unless-stopped \
    -e POSTGRES_USER=hailmary -e POSTGRES_PASSWORD="$BRAIN_PG_PASSWORD" -e POSTGRES_DB=hailmary_brain \
    -p "127.0.0.1:${PG_PORT}:5432" -v "${PGDATA_VOL}:/var/lib/postgresql/data" \
    pgvector/pgvector:pg16 >/dev/null
  sleep 6
fi
# enable pgvector
docker exec "$PG_CONTAINER" psql -U hailmary -d hailmary_brain -c "create extension if not exists vector;" >/dev/null 2>&1 \
  && say "pgvector enabled" || warn "could not enable pgvector yet (DB may still be starting)"

# 3. models
for m in "${OLLAMA_MODELS[@]}"; do say "pull $m"; ollama pull "$m" || warn "pull $m failed"; done

echo
say "LOCAL BRAIN UP. DB: $BRAIN_DATABASE_URL  ·  AI: $OLLAMA_URL"
echo
echo "🔒 Lock it to the mesh (do these):"
echo "  • tailscale up   (this box on the protected tailnet)"
echo "  • Do NOT expose Postgres publicly — it's bound to 127.0.0.1 only. Reach it"
echo "    from other nodes via Tailscale (tailscale serve / SSH tunnel), never a public IP."
echo "  • Tailscale ACL: tag this box 'tag:brain' and allow ONLY owner + family devices."
echo "  • Disk encryption ON (FileVault / LUKS / BitLocker)."
echo
echo "Next: load the schema into the local brain (migrations) + point the app at it:"
echo "  for f in supabase/migrations/*.sql; do docker exec -i $PG_CONTAINER psql -U hailmary -d hailmary_brain < \"\$f\"; done"
echo "  (or run the app against \$BRAIN_DATABASE_URL via self-hosted Supabase — see docs/COOLIFY-SELFHOST.md)"
echo "  The full app+API self-host path is in docs/CURSOR-SEAL-BRAIN-PROMPT.md."
