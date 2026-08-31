#!/usr/bin/env bash
# set-service-key — seat SUPABASE_SERVICE_ROLE_KEY locally + on Vercel, once.
#
# The key is read from a silent prompt: it never lands in your shell history,
# never in an argument list, never on screen. It is PROVEN against the live
# project BEFORE anything is written — a wrong paste changes nothing.
#
#   bash scripts/set-service-key.sh
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'; DIM=$'\033[90m'; B=$'\033[1m'; N=$'\033[0m'
die() { printf '%s✗ %s%s\n' "$RED" "$1" "$N" >&2; exit 1; }
ok()  { printf '%s✓%s %s\n' "$GRN" "$N" "$1"; }

command -v vercel >/dev/null 2>&1 || die "vercel CLI not found. npm i -g vercel"
[ -f .vercel/project.json ] || die "repo is not linked to Vercel (.vercel/project.json missing)"

# ── 1. public values come from Vercel, so local == production. Never guessed.
printf '%spulling public env from Vercel… %s' "$DIM" "$N"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
vercel env pull "$TMP/pub.env" --environment=production --yes >/dev/null 2>&1 \
  || die "vercel env pull failed — run 'vercel login' first"
strip_quotes() { sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//"; }
SUPA_URL="$(grep -m1 '^NEXT_PUBLIC_SUPABASE_URL=' "$TMP/pub.env" | cut -d= -f2- | strip_quotes)"
SUPA_ANON="$(grep -m1 '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' "$TMP/pub.env" | cut -d= -f2- | strip_quotes)"
[ -n "$SUPA_URL" ] || die "NEXT_PUBLIC_SUPABASE_URL is not set on Vercel"
printf '\r%s✓%s public env pulled — %s\033[K\n' "$GRN" "$N" "$SUPA_URL"

# ── 2. silent prompt. Not echoed, not stored, not in history.
printf '\n%sPaste the Supabase SERVICE ROLE key%s %s(input hidden — press Enter when done)%s\n> ' "$B" "$N" "$DIM" "$N"
IFS= read -rs KEY; printf '\n\n'
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"
[ -n "$KEY" ] || die "nothing pasted."

# ── 3. refuse the obvious wrong pastes before touching anything.
case "$KEY" in
  sb_publishable_*) die "that is the PUBLISHABLE (anon) key, not the service role key." ;;
  "$SUPA_ANON")     die "that is the anon key already in use. Need the service_role key." ;;
  sb_secret_*|eyJ*) : ;;
  *) die "that does not look like a Supabase key (expect sb_secret_… or eyJ…)." ;;
esac

# ── 4. PROVE it. signup_invites is REVOKEd from anon, so only a real
#      service_role key gets a 200 here. No proof, no write.
printf '%sproving the key against %s… %s' "$DIM" "$SUPA_URL" "$N"
CODE="$(curl -s -o "$TMP/body" -w '%{http_code}' \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  "$SUPA_URL/rest/v1/signup_invites?select=id&limit=1")"
if [ "$CODE" != "200" ]; then
  printf '\n%s%s%s\n' "$DIM" "$(head -c 300 "$TMP/body")" "$N"
  die "key rejected by Supabase (HTTP $CODE). NOTHING was written."
fi
printf '\r%s✓%s key PROVEN — read signup_invites as service_role\033[K\n' "$GRN" "$N"

# ── 5. write locally. Upsert only — your Telegram tokens in .env.local survive.
upsert() { # file key value
  local f="$1" k="$2" v="$3"
  [ -f "$f" ] || { : > "$f"; chmod 600 "$f"; }
  if grep -q "^${k}=" "$f" 2>/dev/null; then
    grep -v "^${k}=" "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  fi
  printf '%s=%s\n' "$k" "$v" >> "$f"
  chmod 600 "$f"
}
for kv in "NEXT_PUBLIC_SUPABASE_URL|$SUPA_URL" "NEXT_PUBLIC_SUPABASE_ANON_KEY|$SUPA_ANON" "SUPABASE_SERVICE_ROLE_KEY|$KEY"; do
  upsert .env.local "${kv%%|*}" "${kv#*|}"
  upsert "$HOME/.config/tmmt/tmmt-ops.env" "${kv%%|*}" "${kv#*|}"
done
ok ".env.local seated (existing keys preserved, chmod 600)"
ok "~/.config/tmmt/tmmt-ops.env seated (canon secret store, chmod 600)"

# ── 6. seat it on Vercel — all three environments.
for ENV in production preview development; do
  vercel env rm SUPABASE_SERVICE_ROLE_KEY "$ENV" --yes >/dev/null 2>&1
  if printf '%s' "$KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY "$ENV" >/dev/null 2>&1; then
    ok "Vercel $ENV"
  else
    printf '%s! Vercel %s FAILED — add it by hand in the dashboard%s\n' "$YEL" "$ENV" "$N"
  fi
done
unset KEY

printf '\n%s%s══ SEATED ══%s\n' "$B" "$GRN" "$N"
printf '  Env vars only take effect on a NEW build. Next, in order:\n\n'
printf '    npm run ship          %s# build + deploy (owner gate)%s\n' "$DIM" "$N"
printf '    node scripts/invite.mjs --for "Their Name"\n\n'
