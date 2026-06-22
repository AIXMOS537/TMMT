#!/usr/bin/env bash
NAME="${1:-}"; ROLE="${2:-ops}"
[[ -z "$NAME" ]] && { echo "Usage: $0 <name> <role>"; exit 1; }
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
echo "Provisioning team member: $NAME ($ROLE)"
# Remove owner-only files
rm -f "$ROOT/.aixmos/engine" "$ROOT/partner-deploy.env" "$ROOT/cyborg-vault.env" 2>/dev/null
# Role-based env
cp "$ROOT/.env.example" "$ROOT/.env.team.$NAME" 2>/dev/null || touch "$ROOT/.env.team.$NAME"
echo "TEAM_MEMBER=$NAME" >> "$ROOT/.env.team.$NAME"
echo "TEAM_ROLE=$ROLE"   >> "$ROOT/.env.team.$NAME"
chmod 600 "$ROOT/.env.team.$NAME"
cat <<CHECKLIST
  ✓ Engine sealed for $NAME
  ✓ Role env created: .env.team.$NAME
  ┌──────────────────────────────────────────┐
  │  Send $NAME:                             │
  │  1. Slack invite                         │
  │  2. ClickUp access (role: $ROLE)         │
  │  3. GHL sub-account (if sales/ops)       │
  │  4. Tailscale invite                     │
  └──────────────────────────────────────────┘
CHECKLIST
