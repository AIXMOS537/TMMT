#!/usr/bin/env bash
# vercel-ignore — Vercel "Ignored Build Step".
#   exit 0 = SKIP the deploy   |   exit 1 = BUILD/deploy
#
# Only deploy when files that actually affect the running app change. Docs,
# shell scripts, markdown, tools/, and the agent system never trigger a deploy —
# that's what was burning the free-tier daily build quota. Local-first forever:
# ship docs/scripts freely; the live site only rebuilds when the APP changes.
set -uo pipefail

# ---- BOT BRANCH GUARD (2026-09-05) -------------------------------------------
# swarm.sh:125 pushes coordination state to the "swarm-coord" branch. On
# 2026-09-03 that produced 20 deployments in 66 minutes (~3.3 min apart) — all
# BLOCKED, none of which ever reached this script.
#
# vercel.json ALREADY sets git.deploymentEnabled.swarm-coord = false, but that
# setting ships INSIDE a deployment: the commit carrying it (40a6740f6) is itself
# BLOCKED, so the suppression has never taken effect. Config that can only arrive
# via the channel it is meant to protect is not a control.
#
# This guard does not depend on that commit landing. It is evaluated on every
# build attempt, from the branch name Vercel injects at runtime.
BOT_BRANCHES="swarm-coord"
REF="${VERCEL_GIT_COMMIT_REF:-}"
for b in $BOT_BRANCHES; do
  if [ "$REF" = "$b" ]; then
    echo "vercel-ignore: '$REF' is a bot coordination branch — SKIP (never builds)."
    exit 0   # SKIP
  fi
done

# Files/dirs that genuinely affect the deployed Next.js app.
APP_PATHS="src public packages \
package.json package-lock.json \
next.config.ts next.config.js next.config.mjs \
middleware.ts tsconfig.json postcss.config.mjs \
sentry.client.config.ts sentry.server.config.ts sentry.edge.config.ts \
instrumentation.ts vercel.json"

# Determine a base commit to diff against (Vercel provides the previous SHA).
BASE="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$BASE" ]; then
  if git rev-parse HEAD^ >/dev/null 2>&1; then
    BASE="HEAD^"
  else
    echo "vercel-ignore: no base ref available — building to be safe."
    exit 1   # BUILD (don't risk skipping a needed deploy)
  fi
fi

if git diff --quiet "$BASE" HEAD -- $APP_PATHS 2>/dev/null; then
  echo "vercel-ignore: no app-code changes since $BASE — SKIP deploy (docs/scripts only)."
  exit 0     # SKIP
else
  echo "vercel-ignore: app-code changed since $BASE — BUILD."
  exit 1     # BUILD
fi
