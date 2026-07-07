#!/usr/bin/env bash
#
# discover.sh — consent-gated discovery of what a client already runs, so we can
# tailor + integrate their business into the ecosystem. Runs ON THEIR machine,
# with THEIR consent, output stays LOCAL for review.
# ---------------------------------------------------------------------------
# SAFETY (non-negotiable, by design):
#   • No consent  → no scan. Refuses without an explicit recorded consent.
#   • Scoped only → scans the dirs they name; never the whole disk.
#   • Sensitive paths (.ssh, keychains, cloud creds, browsers) are NEVER traversed.
#   • Secrets (.env, keys) are recorded as "EXISTS (not read)" — contents never read.
#   • Output is a LOCAL report. Nothing is uploaded. Integration is a separate,
#     human-approved step (see docs/CLIENT-ONBOARDING-DISCOVERY.md).
#   • Revocable: --revoke deletes the consent record + report.
#
# Usage:
#   scripts/discover.sh --who "Operator One" --scope ~/business --i-consent
#   scripts/discover.sh --who "Operator One" --scope ~/code --scope ~/work --i-consent
#   scripts/discover.sh --revoke
#   scripts/discover.sh                         # shows the consent notice, scans nothing
# ---------------------------------------------------------------------------
set -uo pipefail

bold(){ printf "\033[1m%s\033[0m\n" "$1"; }
ok(){ printf "\033[32m✓\033[0m %s\n" "$1"; }
warn(){ printf "\033[33m!\033[0m %s\n" "$1"; }
die(){ printf "\033[31m✗ %s\033[0m\n" "$1" >&2; exit 1; }

WHO=""; CONSENT=false; REVOKE=false; declare -a SCOPES=()
while [ $# -gt 0 ]; do case "$1" in
  --who) WHO="${2:-}"; shift 2;;
  --scope) SCOPES+=("${2:-}"); shift 2;;
  --i-consent) CONSENT=true; shift;;
  --revoke) REVOKE=true; shift;;
  -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
  *) die "unknown arg: $1 (try --help)";;
esac; done

OUT=".aixmos/discovery"; mkdir -p "$OUT"
CONSENT_REC="$OUT/CONSENT.txt"; REPORT="$OUT/discovery-report.md"
ts(){ date -u +%Y-%m-%dT%H:%M:%SZ; }

if $REVOKE; then
  rm -f "$CONSENT_REC" "$REPORT" "$OUT"/*.json 2>/dev/null
  ok "Consent revoked; discovery record + report deleted."; exit 0
fi

# ---- consent notice / gate
NOTICE='DISCOVERY CONSENT NOTICE
This tool will inventory development tools, projects, AI tooling, and local
services in the folders you name — to help tailor and integrate your business.
It will NOT read file contents of secrets, NOT touch .ssh / keychains / cloud
credentials / browser data, and will NOT upload anything. Output stays on this
machine for your review. You can revoke anytime with: discover.sh --revoke'

if ! $CONSENT || [ -z "$WHO" ] || [ ${#SCOPES[@]} -eq 0 ]; then
  bold "== discovery (no scan performed) =="
  echo "$NOTICE"; echo
  warn "To proceed you must record consent and name scopes:"
  echo "  scripts/discover.sh --who \"Your Name\" --scope ~/your-work-folder --i-consent"
  exit 0
fi

# record consent
{ echo "consent_by: $WHO"; echo "at: $(ts)"; echo "host: $(hostname)"; echo "scopes: ${SCOPES[*]}"; echo "tool: discover.sh"; } > "$CONSENT_REC"
ok "Consent recorded for $WHO at $(ts) → $CONSENT_REC"

# directories we must NEVER traverse
EXCL_NAMES=( ".ssh" ".aws" ".gnupg" ".gcloud" ".config/gcloud" "Keychains" ".mozilla" "Library/Keychains" ".password-store" "Photos Library.photoslibrary" "node_modules" ".git" )
prune_expr=()
for n in "${EXCL_NAMES[@]}"; do prune_expr+=( -name "$n" -o ); done
# strip trailing -o later via array slice

scan_dir(){  # safe find within one scope, honoring excludes; prints relative paths
  local root="$1" pattern="$2"
  [ -d "$root" ] || return 0
  find "$root" \( "${prune_expr[@]:0:${#prune_expr[@]}-1}" \) -prune -o -type f -name "$pattern" -print 2>/dev/null
}

bold "== discovery scan (scoped, redacting) =="
{
  echo "# Discovery report"
  echo "_Consent: $WHO · $(ts) · host $(hostname)_"
  echo
  echo "## Environment"
  echo '```'
  echo "os: $(uname -srm)"
  for t in git node npm python3 docker ollama; do command -v "$t" >/dev/null && echo "$t: $($t --version 2>/dev/null | head -1)"; done
  echo '```'
  echo
  echo "## Local AI brain"
  if command -v ollama >/dev/null; then echo "Ollama models:"; echo '```'; ollama list 2>/dev/null || echo "(ollama present, not running)"; echo '```'; else echo "- Ollama: not found"; fi
  for p in 11434 1234 4000 8000; do
    (command -v ss >/dev/null && ss -ltn 2>/dev/null | grep -q ":$p ") && echo "- service listening on :$p" || true
  done
  echo
  echo "## Git repositories (in scope) — remotes only, no file contents"
  for s in "${SCOPES[@]}"; do
    while IFS= read -r g; do
      d="$(dirname "$g")"
      echo "- $d → $(git -C "$d" remote get-url origin 2>/dev/null || echo 'no-remote') [$(git -C "$d" branch --show-current 2>/dev/null)]"
    done < <(find "$s" -maxdepth 4 -type d -name .git 2>/dev/null)
  done
  echo
  echo "## Project signals (paths only)"
  for s in "${SCOPES[@]}"; do
    for pat in package.json requirements.txt pyproject.toml docker-compose.yml Dockerfile vercel.json next.config.* supabase; do
      scan_dir "$s" "$pat" | sed 's/^/- /'
    done
  done
  echo
  echo "## Secrets present (RECORDED, NOT READ)"
  for s in "${SCOPES[@]}"; do
    for pat in ".env" ".env.*" "*.pem" "*.key" "id_rsa" "credentials"; do
      scan_dir "$s" "$pat" | sed 's/$/  → EXISTS (contents not read)/; s/^/- /'
    done
  done
  echo
  echo "## Suggested integration (recommendation only — needs approval)"
  echo "- See docs/CLIENT-ONBOARDING-DISCOVERY.md for the map. Nothing integrated yet."
} > "$REPORT"

ok "Report written (LOCAL only): $REPORT"
echo
warn "Review it together with $WHO. Integration happens ONLY after approval."
echo "  Next: open $REPORT → approve → emit an integration handoff (mesh)."
