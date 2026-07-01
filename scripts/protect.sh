#!/usr/bin/env bash
#
# protect.sh — the guardian. One sweep that proves the owner is protected on every
# front at once: identity (the naming law), secrets, confidentiality (what leaves
# the building), the locks, and the machine. Run it anytime. If anything that
# protects X has slipped, this is the tripwire that catches it before it hurts.
# ---------------------------------------------------------------------------
#   bash scripts/protect.sh          # full guardian sweep, one verdict
#   bash scripts/protect.sh --quiet  # failures + verdict only
# ---------------------------------------------------------------------------
# Read-only. Prints no secrets and never prints the owner's real name. Defensive:
# it verifies guards, it doesn't weaken any. Pairs with secret-scan / device-
# integrity / account-hardening / master-key.
set -uo pipefail

QUIET=false; [[ "${1:-}" == "--quiet" ]] && QUIET=true
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"; cd "$ROOT"

# the owner's real name — only sanctioned in these owner-only files, NOWHERE else.
REALNAME="Muhammad Taha"
NAME_ALLOW='docs/SEALED-TRUTH.md docs/MASTER-KEY.md scripts/master-key.sh scripts/protect.sh'
# surfaces that reach operators / clients / the public — the name must NEVER be here.
SHAREABLE='dist content README.md src public'

PASS=0; FAIL=0; WARN=0
ok(){   PASS=$((PASS+1)); $QUIET || printf "  \033[32m✓\033[0m %s\n" "$1"; }
bad(){  FAIL=$((FAIL+1)); printf "  \033[41;97m ✗ \033[0m %s\n      \033[2m→ %s\033[0m\n" "$1" "$2"; }
warn(){ WARN=$((WARN+1)); printf "  \033[33m!\033[0m %s\n      \033[2m→ %s\033[0m\n" "$1" "$2"; }
h(){ $QUIET || printf "\n\033[1;96m── %s ──\033[0m\n" "$1"; }

printf "\033[1m🛡️  GUARDIAN\033[0m  —  is the owner protected, right now?\n"
printf "\033[2m%s\033[0m\n" "$(date '+%Y-%m-%d %H:%M')"

# ── 1. IDENTITY — the naming law: X stays X; the real name never leaks ───────
h "IDENTITY (the naming law)"
LEAK=0
for surface in $SHAREABLE; do
  [ -e "$surface" ] || continue
  if grep -rlI "$REALNAME" "$surface" 2>/dev/null | grep -q .; then
    bad "real name found in shareable surface: $surface" "remove it — operators/clients/public must only ever see 'X'"; LEAK=1
  fi
done
[ "$LEAK" = 0 ] && ok "real name: ZERO in every shareable surface (operators/clients see only X)"
# name appears only in the sanctioned owner-only allowlist
STRAY=0
while IFS= read -r f; do
  f="${f#./}"   # normalize: grep emits ./path, allowlist has bare path
  case " $NAME_ALLOW " in *" $f "*) : ;; *) bad "real name in an unsanctioned file: $f" "move it out; the name lives only in the sealed set"; STRAY=1;; esac
done < <(grep -rlI "$REALNAME" . --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null)
[ "$STRAY" = 0 ] && ok "real name confined to the sealed owner-only set (sealed-truth + master-key)"

# ── 2. CONFIDENTIALITY — the sealed truth + key never leave the building ─────
h "CONFIDENTIALITY (what leaves in a bundle)"
BUILD=scripts/build-projectaixmos-legacy.sh
if [ -f "$BUILD" ]; then
  for must in docs/SEALED-TRUTH.md docs/MASTER-KEY.md scripts/master-key.sh; do
    grep -q "\"$must\"" "$BUILD" && ok "excluded from operator bundle: $must" \
      || bad "$must NOT excluded from the bundle" "add it to EXCLUDE in $BUILD — it must never hand off"
  done
else warn "legacy bundle builder not found" "can't verify exclusions"; fi

# ── 3. SECRETS — no live key in the tree; the one open thread ────────────────
h "SECRETS"
if [ -x scripts/secret-scan.sh ]; then
  if bash scripts/secret-scan.sh >/dev/null 2>&1; then ok "secret-scan clean (no key in the tracked tree)"
  else bad "secret-scan flagged something" "bash scripts/secret-scan.sh → rotate + scrub (docs/SECRET-ROTATION.md)"; fi
else warn "secret-scan.sh missing" "restore it — it's a core guard"; fi
if grep -rqi 'REVOKE.*Airtable\|AIRTABLE_TOKEN_REVOKED' docs config 2>/dev/null; then
  bad "Airtable token still flagged for revocation" "airtable.com/create/tokens → delete it (only you can)"
fi

# ── 4. THE LOCKS — master key + kill-switch present and owner-only ──────────
h "THE LOCKS"
[ -f scripts/master-key.sh ] && ok "master key present (phrase + rotating code — only you hold it)" \
  || bad "master-key.sh missing" "restore it — it's the owner's two-factor"
if [ -d "$ROOT/.aixmos/keys" ] || [ -f "$ROOT/.aixmos/master.seal" ]; then ok "master key appears sealed on this machine"
else warn "master key not sealed on THIS machine" "bash scripts/master-key.sh seal (do once, here)"; fi
grep -rqi 'go.dark\|kill.switch' docs 2>/dev/null && ok "go-dark / kill-switch doctrine in place (anyone locks; only you lift)" \
  || warn "go-dark doctrine not found" "see docs/CONFIDENTIALITY-AND-LOCK.md"

# ── 5. THE MACHINE + REPO — the ground it all stands on ─────────────────────
h "MACHINE & REPO"
[ -x scripts/device-integrity.sh ] && ok "device-integrity available (run it to confirm THIS Mac is clean)" \
  || warn "device-integrity.sh missing" "restore it"
REMOTE="$(git remote get-url origin 2>/dev/null || echo none)"
echo "$REMOTE" | grep -qiE 'AIXMOS537/TMMT|Metavibez4L/TMMT' && ok "remote is your private repo" \
  || warn "remote isn't your TMMT repo: $REMOTE" "confirm before pushing"
warn "repo must stay PRIVATE + no stray collaborators" "verify at github.com/<repo>/settings/access (only you)"

# ── VERDICT ─────────────────────────────────────────────────────────────────
printf "\n\033[1m── VERDICT ──\033[0m\n"
printf "  \033[32m%s pass\033[0m · \033[33m%s warn\033[0m · \033[41;97m %s fail \033[0m\n" "$PASS" "$WARN" "$FAIL"
if [ "$FAIL" -eq 0 ]; then
  printf "  \033[42;30m OWNER PROTECTED \033[0m every guard holds. (clear the warnings when you can.)\n"; exit 0
else
  printf "  \033[41;97m EXPOSURE \033[0m fix the ✗ above NOW — each one is a way the owner gets hurt.\n"; exit 1
fi
