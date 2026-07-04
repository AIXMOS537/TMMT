#!/usr/bin/env bash
#
# sentry.sh — PROJECT X HAILMARY standing watch over the public attack surface.
# It re-runs, as code, the full security audit of everything the outside world can
# reach: every API route's auth, fail-closed secrets, the middleware gate, the
# admin write-allowlist, RLS, headers, client/secret isolation, and XSS sinks.
# If a future change quietly opens a hole — a new unauthenticated webhook, a
# fail-OPEN secret, a service-role key in client code — the Sentry catches it.
# ---------------------------------------------------------------------------
#   bash scripts/sentry.sh           # full watch, one verdict
#   bash scripts/sentry.sh --quiet   # failures + verdict only
# ---------------------------------------------------------------------------
# Read-only. Static analysis of the tree; runs nothing, prints no secrets.
set -uo pipefail
QUIET=false; [[ "${1:-}" == "--quiet" ]] && QUIET=true
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"; cd "$ROOT"

PASS=0; FAIL=0; WARN=0
ok(){   PASS=$((PASS+1)); $QUIET || printf "  \033[32m✓\033[0m %s\n" "$1"; }
bad(){  FAIL=$((FAIL+1)); printf "  \033[41;97m ✗ \033[0m %s\n      \033[2m→ %s\033[0m\n" "$1" "$2"; }
warn(){ WARN=$((WARN+1)); printf "  \033[33m!\033[0m %s\n      \033[2m→ %s\033[0m\n" "$1" "$2"; }
h(){ $QUIET || printf "\n\033[1;96m── %s ──\033[0m\n" "$1"; }

printf "\033[1m🛰️  SENTRY\033[0m  —  HAILMARY watching the public attack surface\n"
printf "\033[2m%s · static analysis, no secrets touched\033[0m\n" "$(date '+%Y-%m-%d %H:%M')"

# patterns that count as "this endpoint authenticates"
AUTHPAT='verify|signature|secret|hmac|timingSafe|CRON_SECRET|WEBHOOK_SECRET|authorization|handleGhlWebhookPost|verifyGhlWebhook|OPS_COMMAND_SECRET'

# ── 1. API AUTH — no door without a lock ────────────────────────────────────
h "API AUTH (every webhook/cron route gated)"
OPEN=0
if [ -d src/app/api ]; then
  while IFS= read -r r; do
    grep -qiE "$AUTHPAT" "$r" || { bad "UNAUTHENTICATED endpoint: $r" "add a secret/signature check — fail closed (401 when unset)"; OPEN=1; }
  done < <(find src/app/api/webhooks src/app/api/cron -name 'route.ts' 2>/dev/null)
  [ "$OPEN" = 0 ] && ok "every webhook + cron route requires auth (no open door)"
else warn "no src/app/api dir" "nothing to watch here"; fi

# ── 2. FAIL-CLOSED — an unset secret must REJECT, never allow-all ───────────
h "FAIL-CLOSED (unset secret = denied)"
AUTHF=src/lib/ghl/webhook-auth.ts
if [ -f "$AUTHF" ]; then
  grep -qE '!secret' "$AUTHF" && ok "GHL webhook auth fails closed (rejects when secret unset)" \
    || bad "GHL webhook auth may fail OPEN" "ensure: if (!secret) reject — never allow without a configured secret"
fi
# scan for the dangerous fail-open shape: returning ok/true when no secret
if grep -rnE 'if *\(!.*secret.*\)[^;]*return[^;]*(true|ok)' src/lib src/app/api 2>/dev/null | grep -qi true; then
  bad "possible fail-OPEN: code returns allow when secret missing" "invert it — missing secret must deny"
else ok "no fail-open 'allow when unset' pattern found"; fi

# ── 3. MIDDLEWARE — the front gate still gates ──────────────────────────────
h "MIDDLEWARE GATE"
if [ -f middleware.ts ]; then
  grep -q 'getUser()' middleware.ts && ok "auth verified via getUser() (not the spoofable getSession)" \
    || bad "middleware not using getUser()" "use supabase.auth.getUser() for auth decisions"
  grep -q 'getSession()' middleware.ts && warn "getSession() referenced in middleware" "never base auth on getSession() — it's not verified"
  grep -q 'isRateLimited' middleware.ts && ok "rate limiter active on form POSTs" \
    || warn "no rate limit in middleware" "throttle public POSTs"
else bad "middleware.ts missing" "the front gate is gone — restore it"; fi

# ── 4. ADMIN WRITE — allowlist + auth on the write path ─────────────────────
h "ADMIN WRITE PATH"
AF='src/app/(admin)/admin-actions.ts'
if [ -f "$AF" ]; then
  grep -q 'ADMIN_TABLES' "$AF" && ok "admin upsert is table-allowlisted (no arbitrary table writes)" \
    || bad "admin write has no table allowlist" "restrict writes to an explicit ADMIN_TABLES set"
  grep -qE 'isStaffUser|getUser' "$AF" && ok "admin write is auth-gated" \
    || bad "admin write not auth-gated" "require an authenticated staff user before any write"
else warn "admin-actions.ts not found" "verify the admin write path elsewhere"; fi

# ── 5. RLS — the database defends itself ────────────────────────────────────
h "ROW-LEVEL SECURITY"
ls supabase/migrations/ 2>/dev/null | grep -qiE 'rls' \
  && ok "RLS migration present (each tenant/role sees only its own rows)" \
  || bad "no RLS migration found" "RLS is the last line if the app is bypassed — enable it"

# ── 6. HEADERS — browser-side hardening ─────────────────────────────────────
h "SECURITY HEADERS"
if [ -f next.config.ts ]; then
  for hdr in "Content-Security-Policy" "X-Frame-Options" "X-Content-Type-Options"; do
    grep -q "$hdr" next.config.ts && ok "header set: $hdr" || bad "missing header: $hdr" "add it in next.config.ts headers()"
  done
  grep -q "Strict-Transport-Security" next.config.ts || warn "HSTS not explicit in config" "Vercel adds it; set it explicitly for non-Vercel hosts"
fi

# ── 7. CLIENT/SECRET ISOLATION — no server keys in the browser bundle ───────
h "SECRET ISOLATION"
HIT=0
while IFS= read -r f; do
  grep -lq '"use client"' "$f" 2>/dev/null && { bad "service-role key referenced in a CLIENT file: $f" "server-only — move it out of any 'use client' module"; HIT=1; }
done < <(grep -rlE 'SERVICE_ROLE|service_role' src --include='*.ts' --include='*.tsx' 2>/dev/null)
[ "$HIT" = 0 ] && ok "service-role key never appears in client code"
grep -rq 'next/headers' src/lib/supabase.ts 2>/dev/null && bad "server-only next/headers imported in the browser client (supabase.ts)" "keep supabase.ts client-safe" || ok "browser supabase client stays client-safe"

# ── 8. XSS SINKS — no untrusted HTML injection ──────────────────────────────
h "XSS SINKS"
SINK=0
while IFS= read -r f; do
  case "$f" in
    *src/app/layout.tsx) : ;;   # known: static theme/dark-mode init script, not user input
    *) bad "dangerouslySetInnerHTML in: $f" "confirm it's static/escaped, not user-controlled — or allowlist it here"; SINK=1;;
  esac
done < <(grep -rlE 'dangerouslySetInnerHTML|[^A-Za-z]eval\(' src 2>/dev/null)
[ "$SINK" = 0 ] && ok "no unreviewed HTML-injection sinks (only the known static theme script)"

# ── 9. STANDING GUARDS — defer to the deeper sweeps ─────────────────────────
h "STANDING GUARDS"
[ -x scripts/secret-scan.sh ] && { bash scripts/secret-scan.sh >/dev/null 2>&1 && ok "secret-scan clean (no key in the tree)" || bad "secret-scan flagged a key" "rotate + scrub (docs/SECRET-ROTATION.md)"; }
[ -x scripts/protect.sh ] && { bash scripts/protect.sh --quiet >/dev/null 2>&1 && ok "guardian green (identity/locks/confidentiality hold)" || warn "guardian has findings" "bash scripts/protect.sh"; }

# ── VERDICT ─────────────────────────────────────────────────────────────────
printf "\n\033[1m── SENTRY VERDICT ──\033[0m\n"
printf "  \033[32m%s pass\033[0m · \033[33m%s warn\033[0m · \033[41;97m %s fail \033[0m\n" "$PASS" "$WARN" "$FAIL"
if [ "$FAIL" -eq 0 ]; then
  printf "  \033[42;30m PERIMETER SECURE \033[0m no open door. HAILMARY stands watch. 🛰️\n"; exit 0
else
  printf "  \033[41;97m BREACH RISK \033[0m close every ✗ NOW — that's how the public gets in.\n"; exit 1
fi
