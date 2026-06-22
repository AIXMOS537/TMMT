#!/usr/bin/env bash
# Launch My Agency × Moe Legacy — one-shot pre-shift readiness.
#
# Usage:
#   bash scripts/lma-one-shot.sh shift              # full pre-shift (local + live smoke)
#   bash scripts/lma-one-shot.sh shift --local      # local only (no production curls)
#   bash scripts/lma-one-shot.sh scan-intake        # inventory dropped iPhone/media files
#   bash scripts/lma-one-shot.sh brief                # print sales/compliance quick refs
#
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INTAKE="$ROOT/imports/lma-intake"
LOG_DIR="$ROOT/.hailmary/checks"
mkdir -p "$LOG_DIR" "$INTAKE/media" "$INTAKE/scripts" "$INTAKE/lma" "$INTAKE/moe-legacy" "$INTAKE/instagram" "$INTAKE/work-phone"

if [[ -t 1 ]]; then
  G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; B=$'\e[1m'; D=$'\e[2m'; X=$'\e[0m'
else
  G=; Y=; R=; C=; B=; D=; X=
fi

pass=0; warn=0; fail=0; score=0

ok()   { printf '  %sPASS%s %s\n' "$G" "$X" "$1"; pass=$((pass+1)); }
wn()   { printf '  %sWARN%s %s\n' "$Y" "$X" "$1"; warn=$((warn+1)); }
fl()   { printf '  %sFAIL%s %s\n' "$R" "$X" "$1"; fail=$((fail+1)); }
hdr()  { printf '\n%s%s%s\n' "$B" "$C" "$1"; printf '%s\n' "$X"; }

run_quiet() {
  local label="$1" cmd="$2" weight_ok="${3:-0}" weight_warn="${4:-0}"
  if bash -lc "cd \"$ROOT\" && $cmd" >/dev/null 2>&1; then
    ok "$label"
    score=$((score + weight_ok))
  else
    if [[ "$weight_warn" -gt 0 ]]; then
      wn "$label"
      score=$((score + weight_warn))
    else
      fl "$label"
    fi
  fi
}

cmd_scan_intake() {
  hdr "LMA intake scan — $INTAKE"
  local n
  n="$(find "$INTAKE" -type f ! -name 'README.md' ! -path '*/.DS_Store' 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "${n:-0}" -gt 0 ]]; then
    ok "$n file(s) ready for triage"
    score=$((score + 10))
    find "$INTAKE" -type f ! -name 'README.md' ! -path '*/.DS_Store' 2>/dev/null | head -30 | sed 's/^/    /'
    if [[ "$n" -gt 30 ]]; then
      printf '    %s… and %s more%s\n' "$D" "$((n - 30))" "$X"
    fi
  else
    wn "No intake files yet — Airdrop reels/scripts to imports/lma-intake/ (see README)"
  fi

  if [[ -d "$HOME/Sync/work-phone-intake" ]]; then
    local wp
    wp="$(find "$HOME/Sync/work-phone-intake" -type f 2>/dev/null | wc -l | tr -d ' ')"
    [[ "${wp:-0}" -gt 0 ]] && ok "Work-phone sync folder: $wp file(s) in ~/Sync/work-phone-intake" || wn "~/Sync/work-phone-intake exists but empty"
  else
    wn "No ~/Sync/work-phone-intake — set up on M1 Brainiac for work-phone exports"
  fi

  printf '\n%sNext:%s Drop media → bash scripts/lma-one-shot.sh scan-intake → ask Cursor to triage\n' "$D" "$X"
}

cmd_brief() {
  hdr "Sales + compliance quick refs (Moe Legacy / LMA shifts)"
  cat <<'EOF'
  Compliance (always):
    • Say "credit guidance" — NEVER "credit repair"
    • No guaranteed scores or deletions
    • $97 = software + education access, not a credit outcome

  Read before calls:
    • docs/pitch/02-credit-guidance.md     (objections + pricing)
    • docs/pitch/README.md               (funnel + compliance footer)
    • docs/marketing/2026-06-18-moe-legacy-genie-demo-campaign.md

  Call flow:
    Open → Qualify → Bridge (rental → member → guidance) → One CTA → Tag in GHL

  One-shot readiness:
    bash scripts/lma-one-shot.sh shift
EOF
}

cmd_shift() {
  local local_only=0
  [[ "${1:-}" == "--local" || "${2:-}" == "--local" ]] && local_only=1

  hdr "LAUNCH MY AGENCY × MOE LEGACY — pre-shift one-shot"
  printf '%sCarry Mac:%s %s\n' "$D" "$X" "$(swarm_machine 2>/dev/null || echo carry-mac)"
  printf '%sRepo:%s %s\n' "$D" "$X" "$ROOT"
  printf '%sDoc:%s docs/LMA-MOE-LEGACY-ONE-SHOT.md\n\n' "$D" "$X"

  hdr "1/5 — Sales pack on disk"
  for f in \
    "docs/pitch/02-credit-guidance.md" \
    "docs/pitch/README.md" \
    "docs/marketing/2026-06-18-moe-legacy-genie-demo-campaign.md" \
    "docs/LMA-MOE-LEGACY-ONE-SHOT.md"; do
    if [[ -f "$ROOT/$f" ]]; then ok "$f"; score=$((score + 5)); else fl "Missing $f"; fi
  done

  hdr "2/5 — Local backend (editable mode)"
  run_quiet "Production build (npm run build)" "npm run build" 15 0
  if [[ -x "$ROOT/scripts/swarm-doctor.sh" ]]; then
    run_quiet "Machine doctor (quick)" "bash scripts/swarm-doctor.sh --quick" 10 5
  fi
  if [[ -x "$ROOT/scripts/launch-check.sh" ]]; then
    run_quiet "Launch security gate" "bash scripts/launch-check.sh" 10 0
  fi
  run_quiet "Revenue env audit" "npm run check-env:revenue" 0 5

  hdr "3/5 — Intake (iPhone / Instagram exports / work phone)"
  local n
  n="$(find "$INTAKE" -type f ! -name 'README.md' ! -path '*/.DS_Store' 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "${n:-0}" -gt 0 ]]; then ok "Intake files: $n"; score=$((score + 10))
  else wn "No intake files — export reels/scripts to imports/lma-intake/"; fi

  hdr "4/5 — Production portals"
  if [[ "$local_only" -eq 1 ]]; then
    wn "Skipped live checks (--local). Run: bash scripts/lma-one-shot.sh shift"
  else
    if [[ -x "$ROOT/scripts/smoke-prod.sh" ]]; then
      if bash "$ROOT/scripts/smoke-prod.sh" >/dev/null 2>&1; then
        ok "smoke-prod.sh (command center)"
        score=$((score + 20))
      else
        fl "smoke-prod.sh failed — likely /forms/customer-intake 404 on prod"
      fi
    fi
    urls=(
      "https://tmmt-ops.vercel.app/login|tmmt-ops login"
      "https://aixmos-landing.vercel.app/|aixmos-landing"
    )
    for pair in "${urls[@]}"; do
      url="${pair%%|*}"
      label="${pair#*|}"
      code="$(curl -sS -o /dev/null -w '%{http_code}' -L --max-time 15 "$url" 2>/dev/null || echo 000)"
      if [[ "$code" =~ ^(200|307|308)$ ]]; then ok "$label ($code)"; score=$((score + 5))
      else fl "$label ($code)"; fi
    done
  fi

  hdr "5/5 — Readiness score"
  [[ "$score" -gt 100 ]] && score=100
  printf '  Score: %s%d / 100%s\n' "$B" "$score" "$X"
  if [[ "$fail" -gt 0 ]]; then
    printf '  %sNO-GO%s — fix FAIL items before claiming production-ready.\n' "$R" "$X"
  elif [[ "$score" -ge 75 ]]; then
    printf '  %sGO%s — cleared for LMA / Moe Legacy client shifts (fix WARNs when you can).\n' "$G" "$X"
  elif [[ "$score" -ge 60 ]]; then
    printf '  %sCONDITIONAL%s — you can work shifts; close blockers same day.\n' "$Y" "$X"
  else
    printf '  %sNO-GO%s — run local fixes first.\n' "$R" "$X"
  fi

  printf '\n%sVerdict:%s %d pass · %d warn · %d fail\n' "$D" "$X" "$pass" "$warn" "$fail"
  printf '%sFull guide:%s docs/LMA-MOE-LEGACY-ONE-SHOT.md\n\n' "$D" "$X"
  [[ "$fail" -gt 0 ]] && exit 1 || exit 0
}

swarm_machine() {
  if [[ -f "$ROOT/.swarm/machine" ]]; then tr -d '[:space:]' < "$ROOT/.swarm/machine"; fi
}

case "${1:-shift}" in
  shift|go|ready) shift; cmd_shift "$@" ;;
  scan-intake|intake|scan) cmd_scan_intake ;;
  brief|scripts|compliance) cmd_brief ;;
  help|-h|--help)
    cat <<EOF
Launch My Agency × Moe Legacy — one-shot

  bash scripts/lma-one-shot.sh shift           Full pre-shift (local + live)
  bash scripts/lma-one-shot.sh shift --local Local checks only
  bash scripts/lma-one-shot.sh scan-intake   Inventory dropped phone/media files
  bash scripts/lma-one-shot.sh brief         Sales + compliance quick refs

Also: bash scripts/tmmt lma [shift|scan|brief]
EOF
    ;;
  *)
    echo "Unknown: $1 (try: shift, scan-intake, brief)"
    exit 2
    ;;
esac
