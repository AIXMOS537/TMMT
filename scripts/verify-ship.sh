#!/usr/bin/env bash
# verify-ship.sh — pre-flight checks WITHOUT owner seal or deploy.
# Run before `bash scripts/ship tmmt-ops` to confirm everything works.
#
#   bash scripts/verify-ship.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"

ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
info() { printf '  \033[36m›\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*" >&2; }
die()  { printf '  \033[31m✗ %s\033[0m\n' "$*" >&2; FAIL=1; }
hr()   { printf '\033[2m%s\033[0m\n' "────────────────────────────────────────────────────────"; }

FAIL=0

_vercel_ignored() {
  local rel="$1" pat
  [ -f "$ROOT/.vercelignore" ] || return 1
  while IFS= read -r pat; do
    pat="${pat%%#*}"; pat="${pat%"${pat##*[![:space:]]}"}"
    [ -z "$pat" ] && continue
    case "$pat" in !*) continue ;; esac
    pat="${pat%/}"
    case "$rel" in "$pat"|"$pat"/*) return 0 ;; esac
    case "$pat" in *.*|*\*) case "$rel" in $pat) return 0 ;; esac ;; esac
  done < "$ROOT/.vercelignore"
  return 1
}

hr; printf '  \033[1m🔍 VERIFY SHIP\033[0m  (no deploy, no owner seal)\n'; hr

# 1. Kill switch
if [ -f "$ROOT/.swarm/DARK" ] || [ -f "$ROOT/auth/DARK" ]; then
  die "Kill-switch DARK is on."
else
  ok "Not DARK."
fi

# 2. .vercelignore firewall
[ -f "$ROOT/.vercelignore" ] || die "Missing .vercelignore"
for req in .aixmos/ auth/ config/ docs/ scripts/; do
  grep -qF "$req" "$ROOT/.vercelignore" 2>/dev/null || die ".vercelignore missing $req"
done
ok ".vercelignore covers .aixmos auth config docs scripts"

# 3. Oversized file leak scan (>95 MB)
LEAKS=0
while IFS= read -r big; do
  [ -n "$big" ] || continue
  rel="${big#$ROOT/}"
  if ! _vercel_ignored "$rel"; then
    warn "WOULD UPLOAD >95MB: $rel"
    LEAKS=$((LEAKS + 1))
  fi
done < <(find "$ROOT" \
  \( -path "$ROOT/node_modules" -o -path "$ROOT/.git" -o -path "$ROOT/.next" -o -path "$ROOT/.vercel" \) -prune \
  -o -type f -size +95M -print 2>/dev/null)
[ "$LEAKS" = "0" ] || die "$LEAKS oversized file(s) would upload (100 MB Vercel limit)"
ok "No oversized upload leaks."

# 4. Confidential path spot-check
for probe in auth/OWNER.seal auth/OWNER.seal.bak-20260706 config/AIXMOS-CHARTER.md; do
  [ -e "$ROOT/$probe" ] || continue
  _vercel_ignored "$probe" || die "Confidential path would upload: $probe"
done
ok "Confidential paths blocked from upload."

# 5. Owner seal exists
[ -f "$ROOT/auth/OWNER.seal" ] && ok "Owner seal present." || die "No auth/OWNER.seal"

# 6. Build
info "Running npm run build…"
if npm run build > /tmp/verify-ship-build.log 2>&1; then
  ok "Build passed."
else
  tail -20 /tmp/verify-ship-build.log
  die "Build FAILED (log: /tmp/verify-ship-build.log)"
fi

# 7. Tests
info "Running npm test…"
if npm test > /tmp/verify-ship-test.log 2>&1; then
  ok "Tests passed ($(rg -o '[0-9]+ passed' /tmp/verify-ship-test.log | tail -1 || echo 'ok'))."
else
  tail -15 /tmp/verify-ship-test.log
  die "Tests FAILED"
fi

# 8. Prod smoke (read-only HTTP)
if command -v curl >/dev/null 2>&1; then
  info "Smoke-testing live tmmt-ops…"
  if bash "$ROOT/scripts/smoke-prod.sh" > /tmp/verify-ship-smoke.log 2>&1; then
    ok "Prod smoke passed."
  else
    tail -10 /tmp/verify-ship-smoke.log
    warn "Prod smoke had warnings (may be pre-deploy state)."
  fi
fi

echo
if [ "$FAIL" = "0" ]; then
  ok "ALL CHECKS PASSED — safe to run: bash scripts/ship tmmt-ops"
  exit 0
else
  printf '  \033[31m✗\033[0m Fix failures above before shipping.\n'
  exit 1
fi
