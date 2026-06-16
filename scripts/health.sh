#!/usr/bin/env bash
# health — Cyborg's per-vertical watch. Pings each business and shows green/red.
#   bash scripts/health.sh            full readout
#   bash scripts/health.sh --compact  one tight block (used by watchtower)
# Targets live in watch/targets.tsv (edit freely; no secrets there).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGETS="$ROOT/watch/targets.tsv"
if [[ -t 1 ]]; then G=$'\e[32m'; R=$'\e[31m'; Y=$'\e[33m'; D=$'\e[2m'; BD=$'\e[1m'; W=$'\e[97m'; X=$'\e[0m'; else G=; R=; Y=; D=; BD=; W=; X=; fi
COMPACT=""; [ "${1:-}" = "--compact" ] && COMPACT=1

[ -f "$TARGETS" ] || { echo "  no targets file ($TARGETS)"; exit 0; }

probe() { # url -> prints http code (000 on failure); 5s timeout
  command -v curl >/dev/null 2>&1 || { echo "NOCURL"; return; }
  curl -s -o /dev/null -L --max-time 5 -w '%{http_code}' "$1" 2>/dev/null || echo "000"
}

[ -n "$COMPACT" ] || printf '\n%s   🦾  VERTICAL HEALTH%s\n   ─────────────────────────────────────────────\n' "$BD" "$X"

up=0; down=0; off=0
while IFS=$'\t' read -r emoji label code url; do
  [ -z "${emoji:-}" ] && continue
  case "$emoji" in \#*) continue;; esac
  if [ -z "${url:-}" ] || case "$url" in TODO*) true;; *) false;; esac; then
    printf '   %s  %-26s %s⚙️  unconfigured%s %s(%s)%s\n' "$emoji" "$label" "$Y" "$X" "$D" "${code:-}" "$X"; off=$((off+1)); continue
  fi
  hc="$(probe "$url")"
  if [ "$hc" = "NOCURL" ]; then
    printf '   %s  %-26s %s? curl missing%s\n' "$emoji" "$label" "$Y" "$X"; continue
  fi
  # responding at all = UP (staff apps return 401/403 by design); 000/5xx = DOWN.
  if [ "$hc" = "000" ] || [ -z "$hc" ]; then
    printf '   %s  %-26s %s● DOWN%s  %sno response · %s%s\n' "$emoji" "$label" "$R$BD" "$X" "$D" "$code" "$X"; down=$((down+1))
  elif [ "$hc" -ge 500 ] 2>/dev/null; then
    printf '   %s  %-26s %s● DOWN%s  %sserver err %s · %s%s\n' "$emoji" "$label" "$R$BD" "$X" "$D" "$hc" "$code" "$X"; down=$((down+1))
  elif [ "$hc" = "401" ] || [ "$hc" = "403" ]; then
    printf '   %s  %-26s %s● UP 🔒%s %sprotected %s · %s%s\n' "$emoji" "$label" "$G$BD" "$X" "$D" "$hc" "$code" "$X"; up=$((up+1))
  else
    printf '   %s  %-26s %s● UP%s    %s%s · %s%s\n' "$emoji" "$label" "$G$BD" "$X" "$D" "$hc" "$code" "$X"; up=$((up+1))
  fi
done < "$TARGETS"

printf '   ─────────────────────────────────────────────\n'
printf '   %s%s up%s · %s%s down%s · %s%s unconfigured%s\n' "$G" "$up" "$X" "$R" "$down" "$X" "$Y" "$off" "$X"
[ -n "$COMPACT" ] || printf '%s   edit targets: watch/targets.tsv%s\n\n' "$D" "$X"
