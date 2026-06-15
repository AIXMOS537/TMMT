#!/usr/bin/env bash
# TMMT — fresh-Mac setup. Gets EVERYTHING this machine needs, from near-zero,
# then joins the mesh and runs a health check. Safe to re-run.
#
# How to use on a brand-new Mac:
#   1) Save this file to the Mac (Downloads is fine).
#   2) Open Terminal (cmd+space → type Terminal → Enter).
#   3) Run:  bash ~/Downloads/setup-mac.command
#
# It installs: Xcode tools, Homebrew, git, Node, tmux, Tailscale, GitHub CLI,
# the Claude CLI; clones the repo; restores .env from your key flashdrive;
# installs deps; joins the mesh; and audits security + readiness.
set -uo pipefail

REPO_URL="https://github.com/AIXMOS537/TMMT.git"
DEST="$HOME/Projects/TMMT"

say(){ printf '%s\n' "$*"; }
ok(){ printf '\033[32m✓\033[0m %s\n' "$*"; }
warn(){ printf '\033[33m!\033[0m %s\n' "$*" >&2; }
step(){ printf '\n\033[1m== %s ==\033[0m\n' "$*"; }

step "TMMT fresh-Mac setup"

# 0) Xcode Command Line Tools (gives you git + compilers)
if ! xcode-select -p >/dev/null 2>&1; then
  warn "Installing Xcode Command Line Tools…"
  warn "→ Click INSTALL in the popup, wait for it to finish, then run me again."
  xcode-select --install >/dev/null 2>&1 || true
  exit 0
fi
ok "Xcode Command Line Tools"

# 1) Homebrew (the Mac app installer)
if ! command -v brew >/dev/null 2>&1; then
  say "Installing Homebrew (you may be asked for your Mac password)…"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || warn "Homebrew install hit an error"
fi
# Make sure brew is on PATH this session (Apple Silicon + Intel)
[[ -x /opt/homebrew/bin/brew ]] && eval "$(/opt/homebrew/bin/brew shellenv)"
[[ -x /usr/local/bin/brew ]] && eval "$(/usr/local/bin/brew shellenv)"
command -v brew >/dev/null 2>&1 && ok "Homebrew" || { warn "Homebrew not on PATH — install from https://brew.sh, then re-run."; exit 1; }

# 2) Core tools
step "Core tools"
for pkg in git node tmux gh; do
  if command -v "$pkg" >/dev/null 2>&1; then ok "$pkg"
  else say "Installing $pkg…"; brew install "$pkg" || warn "couldn't install $pkg"; fi
done
# Tailscale (for remote-assist). CLI via brew; the menu-bar app also works.
if command -v tailscale >/dev/null 2>&1; then ok "tailscale"
else say "Installing Tailscale…"; brew install tailscale 2>/dev/null || brew install --cask tailscale 2>/dev/null || warn "install Tailscale from https://tailscale.com/download/mac"; fi
# gitleaks (deep secret scanning — optional but recommended)
command -v gitleaks >/dev/null 2>&1 && ok "gitleaks" || { brew install gitleaks 2>/dev/null && ok "gitleaks" || warn "gitleaks optional — skipped"; }

# 3) Claude Code CLI
step "Claude CLI"
if command -v claude >/dev/null 2>&1; then ok "claude CLI"
else
  say "Installing the Claude CLI…"
  # Preferred on macOS: Homebrew cask (we already have brew); fall back to the
  # official native installer (auto-updating).
  brew install --cask claude-code >/dev/null 2>&1 \
    || curl -fsSL https://claude.ai/install.sh | bash \
    || warn "Install Claude Code manually: https://code.claude.com/docs/en/quickstart"
  command -v claude >/dev/null 2>&1 && ok "claude CLI installed" \
    || warn "claude not on PATH yet — open a new Terminal after setup, or see the docs link above."
fi

# 4) GitHub sign-in (needed to clone the private repo)
step "GitHub access"
if git ls-remote "$REPO_URL" >/dev/null 2>&1; then
  ok "GitHub access works"
else
  say "Sign in to GitHub (a browser/device-code prompt will appear)…"
  gh auth login || warn "run 'gh auth login' then re-run me"
  gh auth setup-git >/dev/null 2>&1 || true
fi

# 5) Clone or update the repo
step "Repository"
if [[ -d "$DEST/.git" ]]; then
  ok "repo present — updating"; git -C "$DEST" pull --ff-only origin master 2>/dev/null || warn "couldn't fast-forward (local changes?)"
else
  mkdir -p "$(dirname "$DEST")"
  git clone "$REPO_URL" "$DEST" && ok "cloned to $DEST" || { warn "clone failed (auth?). Run 'gh auth login' and re-run."; exit 1; }
fi
cd "$DEST"

# 6) Secrets (.env) — pulled from Vercel, the source of truth. No flashdrive needed.
step "Secrets (.env)"
if [[ -f .env ]]; then
  chmod 600 .env 2>/dev/null || true; ok ".env already present"
else
  say "No .env yet — pulling it securely from Vercel (no flashdrive needed)…"
  command -v vercel >/dev/null 2>&1 || { say "Installing the Vercel CLI…"; npm install -g vercel >/dev/null 2>&1 || warn "couldn't install vercel CLI"; }
  if command -v vercel >/dev/null 2>&1; then
    vercel login || warn "Vercel login skipped"
    vercel link --yes >/dev/null 2>&1 || vercel link || warn "Vercel link skipped (pick the tmmt-ops project)"
    if vercel env pull .env --environment=production --yes >/dev/null 2>&1 || vercel env pull .env >/dev/null 2>&1; then
      chmod 600 .env 2>/dev/null || true; ok ".env pulled from Vercel"
    else
      warn "couldn't auto-pull — run later:  vercel env pull .env --environment=production"
    fi
  fi
  [[ -f .env ]] || warn "No .env — that's OK: build, tests, and the swarm all work without it. Pull it anytime with: vercel env pull .env"
fi

# 7) Dependencies
step "Dependencies"
if [[ -f package-lock.json ]]; then npm ci --no-audit --no-fund || npm install --no-audit --no-fund; else npm install --no-audit --no-fund; fi
ok "dependencies installed"

# 8) Join the mesh + full audit
step "Join the mesh"
bash scripts/swarm-join.sh || warn "swarm-join finished with warnings"
say ""
bash scripts/swarm-doctor.sh || true

step "Done"
ok "This Mac is set up."
say "Go live any time with:   cd $DEST && bash scripts/tmmt up"
say "Need help later:         bash scripts/tmmt help \"what's wrong\""
say "See the cheat sheet:     open docs/cheatsheets/TMMT-CHEAT-SHEET.pdf"
