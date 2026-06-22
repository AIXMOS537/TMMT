#!/usr/bin/env bash
# x-profile.sh — shared X identity layer (GHOST / X / HAILMARY).
# Owner-local source of truth: ~/.hailmary/X-PROFILE.md (never commit secrets).

X_PROFILE="${HAILMARY_X_PROFILE:-$HOME/.hailmary/X-PROFILE.md}"

x_profile_present() { [ -f "$X_PROFILE" ]; }

x_callsign() {
  x_profile_present || return 1
  grep -E '^[^#[:space:]].*·' "$X_PROFILE" 2>/dev/null | head -1 \
    | sed 's/^[[:space:]-]*//;s/[[:space:]]*$//'
}

load_x_profile() {
  if x_profile_present; then
    local tag=""
    tag="$(x_callsign 2>/dev/null || true)"
    if type ok >/dev/null 2>&1; then
      ok "X profile loaded${tag:+ — $tag}"
    else
      printf 'X profile loaded%s\n' "${tag:+ — $tag}"
    fi
    return 0
  fi
  if type warn >/dev/null 2>&1; then
    warn "X profile missing ($X_PROFILE) — edit it so HAILMARY knows you as X"
  else
    echo "X profile missing ($X_PROFILE)" >&2
  fi
  return 1
}

x_profile_absorb_section() {
  echo "## X profile (owner identity — GHOST/X/HAILMARY)"
  if x_profile_present; then
    sed 's/^/  /' "$X_PROFILE" | head -80
  else
    echo "  (missing — create $X_PROFILE)"
  fi
}

x_profile_body() {
  x_profile_present || return 1
  grep -vE '^_(Add|example)|^_example' "$X_PROFILE" 2>/dev/null | head -55
}

x_profile_sys() {
  local base="${1:-}"
  local xbody=""
  if xbody="$(x_profile_body 2>/dev/null)"; then
    printf '%s\n\n--- OWNER X PROFILE (read before every task) ---\n%s' "$base" "$xbody"
  else
    printf '%s' "$base"
  fi
}

seed_x_profile_if_missing() {
  x_profile_present && return 0
  mkdir -p "$(dirname "$X_PROFILE")"
  cat > "$X_PROFILE" <<'XEOF'
# X — Owner Profile (PROJECT X HAILMARY)
# Owner-local only (~/.hailmary/). HAILMARY reads this to know YOU.

## Who X is
- **GHOST** = the real you (private, protected).
- **X** = the public node (AIXMOS brand — what the world sees).
- **HAILMARY** = your private operative — serves GHOST only, never sold.

## Callsign
your-machine · PROJECT X · HAILMARY

## Current active missions (edit weekly)
1. _your mission here_

## Do-not-cross (hard)
- Personal line +1 571-351-9690 — never contact.
- No financial/legal/irreversible without explicit "yes, do it now."
XEOF
  chmod 600 "$X_PROFILE"
}

sync_x_profile_lib() {
  local dest="$HOME/.hailmary/lib/x-profile.sh"
  mkdir -p "$(dirname "$dest")"
  cp "${BASH_SOURCE[0]}" "$dest"
  chmod 600 "$dest"
}
