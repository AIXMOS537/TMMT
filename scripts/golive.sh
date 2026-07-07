#!/usr/bin/env bash
# golive — the one-go launch sequence. Run at the carry Mac:  bash scripts/golive.sh
# (word: golive)  Does everything automatable, assembles the founder send-packs,
# lists the exact owner taps, then boots the whole base. HAILMARY in one breath.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -t 1 ]]; then G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; W=$'\e[97m'; D=$'\e[2m'; BD=$'\e[1m'; X=$'\e[0m'; else G=; Y=; R=; C=; W=; D=; BD=; X=; fi
step(){ printf '\n%s%s━━ %s ━━%s\n' "$C" "$BD" "$*" "$X"; }
ok(){ printf '  %s✓%s %s\n' "$G" "$X" "$*"; }
tap(){ printf '  %s▸ TAP %s:%s %s\n' "$Y$BD" "$1" "$X" "$2"; }

# --- purge mode: delete old token-carrying branches from origin (guarded) ---
if [ "${1:-}" = "purge" ]; then
  printf '\n%s%s  🧹 PURGE — clean old branches off GitHub%s\n' "$C" "$BD" "$X"
  git -C "$ROOT" fetch --prune origin >/dev/null 2>&1 || true
  keep="master|main|$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
  merged="$(git -C "$ROOT" branch -r --merged origin/master 2>/dev/null | sed 's# *origin/##' | grep -vE "HEAD|^($keep)$" || true)"
  unmerged="$(git -C "$ROOT" branch -r --no-merged origin/master 2>/dev/null | sed 's# *origin/##' | grep -vE "HEAD|^($keep)$" || true)"
  printf '\n  %sMerged into master (safe to delete):%s\n' "$BD" "$X"; printf '   %s\n' ${merged:-（none）}
  printf '\n  %sNOT merged (would lose unique work if deleted):%s\n' "$Y" "$X"; printf '   %s\n' ${unmerged:-（none）}
  printf '\n  Delete the MERGED branches now? [y/N] '; IFS= read -r a || true
  if [ "$a" = "y" ] || [ "$a" = "Y" ]; then
    for b in $merged; do git -C "$ROOT" push origin --delete "$b" >/dev/null 2>&1 && ok "deleted $b" || true; done
  fi
  printf '\n  Also delete the UNMERGED branches? This is destructive. Type DELETE to confirm: '; IFS= read -r a2 || true
  if [ "$a2" = "DELETE" ]; then
    for b in $unmerged; do git -C "$ROOT" push origin --delete "$b" >/dev/null 2>&1 && ok "deleted $b" || true; done
  else
    printf '  %skept unmerged branches (revocation already neutralized the token).%s\n' "$D" "$X"
  fi
  printf '\n  %sNote: GitHub caches commits until GC — revocation is the real lock.%s\n\n' "$D" "$X"
  exit 0
fi

cat <<EOF

  ${C}${BD}╔══════════════════════════════════════════════════╗
  ║   🚀  G O   L I V E   —  HAILMARY, one breath      ║
  ╚══════════════════════════════════════════════════╝${X}
EOF

# 1. Update to latest.
step "1/6  Update"
git -C "$ROOT" pull origin "$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)" >/dev/null 2>&1 \
  && ok "pulled latest" || printf '  ! offline or diverged — continuing on-disk\n'

# 2. Security gate.
step "2/6  Security gate"
bash "$ROOT/scripts/launch-check.sh" 2>/dev/null | sed -n '/Verdict/p;/Owner-hand/,/rotate/p' || true

# 3. The one external lock — the token.
step "3/6  The token lock"
THits="$(git -C "$ROOT" log --all -p 2>/dev/null | grep -oE 'pat8mah6k[A-Za-z0-9]{5,}' | wc -l | tr -d ' ')"
if [ "${THits:-0}" -gt 0 ]; then
  printf '  %s⚠ the old Airtable token is still reachable in some history.%s\n' "$R" "$X"
  printf '     The ONLY guaranteed fix is revocation. Open now? (airtable.com/create/tokens)\n'
else
  ok "no live token reachable in scanned history"
fi
printf '  Have you REVOKED the Airtable token (pat8mah6k…)?  [y/N] '
IFS= read -r REV || true
[ "$REV" = "y" ] || [ "$REV" = "Y" ] && ok "token revoked — the lock is set" || printf '  %s▸ do this from any browser before sending links — it is the real lock.%s\n' "$Y" "$X"

# 4. (retired) Founder send-packs — terminal cut 2026-07-06: no outside operators.

# 5. The owner taps that only you can do.
step "5/6  Your taps (only you can do these)"
tap 1 "Revoke the Airtable token if you haven't — airtable.com/create/tokens"
tap 2 "(optional) purge old token-carrying branches:  bash scripts/golive.sh purge"

# 6. Boot everything.
step "6/6  Boot the base"
ok "launching unison…"
exec bash "$ROOT/scripts/mesh/unison.sh" up
