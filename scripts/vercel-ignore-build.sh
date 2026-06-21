#!/usr/bin/env bash
#
# Vercel "Ignored Build Step" — stop the daily-deploy burn.
#
# Vercel's git integration tries to deploy EVERY push (and this repo feeds
# several Vercel projects), which blew past the free 100-deploys/day limit.
# This makes git auto-deploy ONLY the production branch; every other branch is
# skipped. Deploy those yourself, on demand, via the CLI (`bin/ship`).
#
# Vercel contract: exit 1 = build/deploy, exit 0 = skip.
# Override the prod branch per project with the VERCEL_PROD_BRANCH env var.

PROD_BRANCH="${VERCEL_PROD_BRANCH:-master}"
REF="${VERCEL_GIT_COMMIT_REF:-}"

if [ "$REF" = "$PROD_BRANCH" ] || [ "$REF" = "main" ]; then
  echo "Production branch ($REF) → building."
  exit 1
fi

echo "Non-production branch ($REF) → skipping git deploy. Use 'bin/ship' to deploy via CLI."
exit 0
