#!/usr/bin/env bash
# launch-check — pre-launch security + readiness gate. Verifies the protections
# are in place BEFORE anything goes live, and lists the owner-hand items only you
# can do. PASS / WARN / FAIL.   bash scripts/launch-check.sh   (word: secure)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -t 1 ]]; then G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; BD=$'\e[1m'; D=$'\e[2m'; X=$'\e[0m'; else G=; Y=; R=; C=; BD=; D=; X=; fi
pass=0; warn=0; fail=0
P(){ printf '   %sPASS%s %s\n' "$G" "$X" "$*"; pass=$((pass+1)); }
Wn(){ printf '   %sWARN%s %s\n' "$Y" "$X" "$*"; warn=$((warn+1)); }
Fl(){ printf '   %sFAIL%s %s\n' "$R" "$X" "$*"; fail=$((fail+1)); }

printf '\n%s%s  🛡️  LAUNCH SECURITY CHECK%s\n  ─────────────────────────────\n' "$C" "$BD" "$X"

# --- automated checks (the machine can verify) ---
printf '\n%s  Automated%s\n' "$BD" "$X"
# 1. owner seal
[ -f "$ROOT/auth/OWNER.seal" ] && P "owner seal set (owner role + dark-lift gated by your word)" \
  || Wn "owner seal NOT set — run: bash scripts/owner-seal.sh seal"
# 2. secret-guard hooks
if [ "$(git -C "$ROOT" config core.hooksPath 2>/dev/null)" = "scripts/hooks" ]; then P "secret-guard hooks active (pre-commit + pre-push)"; else Wn "hooks not wired — run: git config core.hooksPath scripts/hooks"; fi
# 3. gitleaks config
[ -f "$ROOT/.gitleaks.toml" ] && P "gitleaks config present (push scan + allowlist)" || Wn "no .gitleaks.toml"
# 4. NO secret files tracked  (hard fail)
tracked="$(git -C "$ROOT" ls-files | grep -Ei '(^|/)\.env(\.|$)|\.pem$|\.p12$|id_(rsa|ed25519)$' | grep -v '\.example$' || true)"
[ -z "$tracked" ] && P "no secret files tracked in git" || Fl "secret file(s) TRACKED: $tracked"
# 5. .env gitignored
grep -q '^\.env' "$ROOT/.gitignore" 2>/dev/null && P ".env is gitignored" || Wn ".env not in .gitignore"
# 6. kill switch present
[ -x "$ROOT/scripts/godark" ] && P "kill switch ready (dark / light)" || Wn "godark missing"
# 7. fail-closed auth
grep -rq "fails closed\|redirect.*login" "$ROOT/middleware.ts" 2>/dev/null && P "middleware auth fails closed" || Wn "verify middleware fail-closed"
# 8. operator fencing assets
[ -f "$ROOT/scripts/partner-deploy/tailscale-acl.json" ] && P "Tailscale ACL present (least-privilege lanes)" || Wn "no tailscale-acl.json"
[ -x "$ROOT/scripts/partner-deploy/owner/kill-partner.sh" ] && P "per-operator kill switch present" || Wn "kill-partner.sh missing"
# 9. dark currently?
[ -f "$ROOT/.swarm/DARK" ] && Wn "system is currently DARK (lift with: light)" || P "system is clear (not blacked out)"

# --- owner-hand items (only you can do these) ---
printf '\n%s  Owner-hand — do these before launch (I cannot do them for you)%s\n' "$BD" "$X"
printf '   %s•%s REVOKE the old Airtable token (pat8mah6k…) → airtable.com/create/tokens\n' "$Y" "$X"
printf '   %s•%s GitHub: enable 2FA (both accounts) + branch protection on master + Secret Scanning/Push Protection\n' "$Y" "$X"
printf '   %s•%s Encrypt every node disk: FileVault (Mac) / BitLocker (Windows)\n' "$Y" "$X"
printf '   %s•%s Approve each device in the Tailscale admin (least-privilege)\n' "$Y" "$X"
printf '   %s•%s If the old key flashdrive is unaccounted for: rotate SUPABASE_SERVICE_ROLE_KEY + GHL secret\n' "$Y" "$X"

# --- verdict ---
printf '\n  ─────────────────────────────\n'
printf '  Verdict: %s%d pass%s · %s%d warn%s · %s%d fail%s\n' "$G" "$pass" "$X" "$Y" "$warn" "$X" "$R" "$fail" "$X"
if [ "$fail" -gt 0 ]; then printf '  %s✗ FIX THE FAILS before launch.%s\n\n' "$R" "$X"; exit 1
elif [ "$warn" -gt 0 ]; then printf '  %s▲ Safe to launch once the owner-hand items are done.%s\n\n' "$Y" "$X"
else printf '  %s✓ Locked and protected — clear to launch.%s\n\n' "$G" "$X"; fi
