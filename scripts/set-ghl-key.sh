#!/usr/bin/env bash
# set-ghl-key — seat the GoHighLevel API token locally, once, without it ever
# being visible.
#
# The token is read from a SILENT prompt: it never lands in your shell history,
# never in an argument list, never on screen, never in a file the agent reads.
# It is PROVEN against the live GHL location BEFORE anything is written — a
# wrong paste changes nothing.
#
#   bash scripts/set-ghl-key.sh            # paste + prove + seat locally
#   bash scripts/set-ghl-key.sh --check    # verify the token already seated
#   bash scripts/set-ghl-key.sh --vercel   # also seat on Vercel (owner gate)
#   bash scripts/set-ghl-key.sh --fleet    # also seat on the other machines over ssh
#   bash scripts/set-ghl-key.sh --all      # local + fleet + Vercel: one paste, everywhere
#
# Where it lands (both chmod 600, both outside git):
#   .env.local                      GHL_API_KEY
#   ~/.config/tmmt/ghl.env          GHL_API_KEY  (canon secret store)
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
umask 077

RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'; DIM=$'\033[90m'; B=$'\033[1m'; N=$'\033[0m'
die() { printf '%s✗ %s%s\n' "$RED" "$1" "$N" >&2; exit 1; }
ok()  { printf '%s✓%s %s\n' "$GRN" "$N" "$1"; }

API_BASE="https://services.leadconnectorhq.com"
API_V1="https://rest.gohighlevel.com/v1"
API_VERSION="2021-07-28"
STORE="$HOME/.config/tmmt/ghl.env"

# Every machine that reads a GHL token, and the file each one reads. Measured
# 2026-09-09: the token lived in FIVE places across the fleet and only one of them
# had it — Carry's canonical store was empty since INC-001, Vercel had no GHL key
# at all, and M1 (where the contact sync actually runs) held a revoked one. One
# paste has to reach all of them or they drift apart again by the next rotation.
FLEET_HOSTS="${GHL_FLEET_HOSTS:-rick}"
FLEET_FILES="${GHL_FLEET_FILES:-aixmos-KEYS-canonical/tmmt-os/.env.local .config/tmmt/ghl.env}"

DO_CHECK=0; DO_VERCEL=0; DO_FLEET=0
for a in "$@"; do
  case "$a" in
    --check)  DO_CHECK=1 ;;
    --vercel) DO_VERCEL=1 ;;
    --fleet)  DO_FLEET=1 ;;
    --all)    DO_VERCEL=1; DO_FLEET=1 ;;
    -h|--help) sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown flag: $a" ;;
  esac
done

command -v curl >/dev/null 2>&1 || die "curl not found."
mkdir -p "$HOME/.config/tmmt" || die "cannot create ~/.config/tmmt"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"; unset KEY' EXIT

strip_quotes() { sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//"; }
read_var() { # file key  -> value on stdout
  # .env.local can carry the same key twice (an empty placeholder plus the real
  # one). dotenv lets the LAST assignment win, so take the last NON-EMPTY value
  # — grep -m1 would hand back the empty placeholder.
  [ -f "$1" ] || return 1
  grep "^${2}=" "$1" | cut -d= -f2- | strip_quotes | grep -v '^$' | tail -1
}

# ── location id: needed to prove the token actually reaches YOUR sub-account.
LOC="$(read_var .env.local GHL_LOCATION_ID)"
[ -n "${LOC:-}" ] || LOC="$(read_var "$STORE" GHL_LOCATION_ID)"
[ -n "${LOC:-}" ] || die "GHL_LOCATION_ID is not set in .env.local or $STORE"

# fingerprint lets you confirm WHICH token is seated without ever showing it
fp() { printf '%s' "$1" | shasum -a 256 | cut -c1-8; }

# ── prove(): the only place the token is used. Prints a verdict, never the token.
prove() { # $1 = token   -> 0 on success, sets PROVE_NAME / PROVE_API
  local k="$1" code code1
  code="$(curl -s -o "$TMP/body" -w '%{http_code}' --max-time 20 \
    -H "Authorization: Bearer $k" -H "Version: $API_VERSION" -H "Accept: application/json" \
    "$API_BASE/locations/$LOC")"
  if [ "$code" = "200" ]; then
    PROVE_API="v2"
    PROVE_NAME="$(sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$TMP/body" | head -1)"
    return 0
  fi
  # legacy v1 API key (JWT) fallback
  code1="$(curl -s -o "$TMP/body1" -w '%{http_code}' --max-time 20 \
    -H "Authorization: Bearer $k" -H "Accept: application/json" \
    "$API_V1/locations/")"
  if [ "$code1" = "200" ]; then
    PROVE_API="v1 (legacy)"
    PROVE_NAME="$(sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$TMP/body1" | head -1)"
    return 0
  fi
  PROVE_CODE="v2=$code v1=$code1"
  PROVE_BODY="$(head -c 240 "$TMP/body")"
  return 1
}

# ── --check: prove whatever is already seated. No paste needed.
if [ "$DO_CHECK" = "1" ]; then
  KEY="$(read_var .env.local GHL_API_KEY)"
  [ -n "${KEY:-}" ] || KEY="$(read_var "$STORE" GHL_API_KEY)"
  [ -n "${KEY:-}" ] || die "no GHL_API_KEY seated yet. Run: bash scripts/set-ghl-key.sh"
  printf '%schecking seated token (fp %s) against location %s… %s' "$DIM" "$(fp "$KEY")" "$LOC" "$N"
  if prove "$KEY"; then
    printf '\r%s✓%s token VALID — %s via API %s\033[K\n' "$GRN" "$N" "${PROVE_NAME:-(location $LOC)}" "$PROVE_API"
    exit 0
  fi
  printf '\n'; die "seated token REJECTED by GHL ($PROVE_CODE)."
fi

# ── 1. silent prompt. Not echoed, not stored, not in history, not in argv.
printf '\n%sPaste the GoHighLevel API token%s\n' "$B" "$N"
printf '%s  Private Integration Token (pit-…) preferred, or a legacy v1 API key (eyJ…).\n' "$DIM"
printf '  Sub-account → Settings → Private Integrations → Create.\n'
printf '  Scopes needed for JV work: locations.readonly, contacts.readonly/write,\n'
printf '  opportunities.readonly/write, workflows.readonly, forms.readonly.\n'
printf '  Input is HIDDEN — paste, then press Enter.%s\n> ' "$N"
IFS= read -rs KEY; printf '\n\n'
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"
[ -n "$KEY" ] || die "nothing pasted."

# ── 2. refuse obvious wrong pastes before touching the network.
case "$KEY" in
  pit-*|eyJ*) : ;;
  "$LOC")     die "that is the LOCATION ID, not a token." ;;
  *)          die "that does not look like a GHL token (expect pit-… or eyJ…)." ;;
esac

# ── 3. PROVE it. No proof, no write.
printf '%sproving token (fp %s) against location %s… %s' "$DIM" "$(fp "$KEY")" "$LOC" "$N"
if ! prove "$KEY"; then
  printf '\n%s%s%s\n' "$DIM" "${PROVE_BODY:-}" "$N"
  die "token REJECTED by GHL ($PROVE_CODE). NOTHING was written."
fi
printf '\r%s✓%s token PROVEN — %s via API %s\033[K\n' "$GRN" "$N" "${PROVE_NAME:-(location $LOC)}" "$PROVE_API"

# ── 4. write locally. Upsert only — every other key in the file survives.
upsert() { # file key value
  local f="$1" k="$2" v="$3"
  [ -f "$f" ] || { : > "$f"; }
  chmod 600 "$f"
  if grep -q "^${k}=" "$f" 2>/dev/null; then
    grep -v "^${k}=" "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  fi
  printf '%s=%s\n' "$k" "$v" >> "$f"
  chmod 600 "$f"
}
upsert .env.local GHL_API_KEY "$KEY"
upsert "$STORE"   GHL_API_KEY "$KEY"
upsert "$STORE"   GHL_LOCATION_ID "$LOC"
ok ".env.local seated (other keys preserved, chmod 600)"
ok "$STORE seated (canon secret store, chmod 600)"

# ── 5. The rest of the fleet. Same prove-then-write rule, over ssh.
if [ "$DO_FLEET" = "1" ]; then
  for host in $FLEET_HOSTS; do
    for rel in $FLEET_FILES; do
      # The token goes over STDIN, never in argv: arguments are visible in `ps` on
      # the remote host for as long as the command runs.
      if printf '%s' "$KEY" | ssh -o BatchMode=yes -o ConnectTimeout=10 "$host" \
           "f=\"\$HOME/$rel\"; mkdir -p \"\$(dirname \"\$f\")\"; touch \"\$f\"; chmod 600 \"\$f\";
            k=\$(cat); [ -n \"\$k\" ] || exit 3;
            grep -v '^GHL_API_KEY=' \"\$f\" > \"\$f.tmp\" 2>/dev/null || : > \"\$f.tmp\";
            printf 'GHL_API_KEY=%s\\n' \"\$k\" >> \"\$f.tmp\";
            mv \"\$f.tmp\" \"\$f\"; chmod 600 \"\$f\";
            grep -q '^GHL_LOCATION_ID=' \"\$f\" || printf 'GHL_LOCATION_ID=%s\\n' '$LOC' >> \"\$f\"" 2>/dev/null; then
        ok "$host:~/$rel"
      else
        printf '%s! %s:~/%s FAILED — seat it there by hand%s\n' "$YEL" "$host" "$rel" "$N"
      fi
    done
  done
else
  printf '%s  (this machine only. --fleet seats the other machines, --all does everything.)%s\n' "$DIM" "$N"
fi

# ── 6. Vercel is OPT-IN. Env vars are owner-gated; --vercel is the seal.
if [ "$DO_VERCEL" = "1" ]; then
  command -v vercel >/dev/null 2>&1 || die "vercel CLI not found. npm i -g vercel"
  for ENV in production preview development; do
    vercel env rm GHL_API_KEY "$ENV" --yes >/dev/null 2>&1
    if printf '%s' "$KEY" | vercel env add GHL_API_KEY "$ENV" >/dev/null 2>&1; then
      ok "Vercel $ENV"
    else
      printf '%s! Vercel %s FAILED — add it by hand in the dashboard%s\n' "$YEL" "$ENV" "$N"
    fi
  done
else
  printf '%s  (local only. Add --vercel to seat it on Vercel too — owner gate.)%s\n' "$DIM" "$N"
fi

FPRINT="$(fp "$KEY")"
unset KEY

printf '\n%s%s══ SEATED ══%s  fingerprint %s\n' "$B" "$GRN" "$N" "$FPRINT"
printf '  Verify any time without re-pasting:\n\n'
printf '    bash scripts/set-ghl-key.sh --check\n\n'
