#!/usr/bin/env bash
NAME="${1:-}"; TIER="${2:-TASTE}"; KEY="${3:-}"
[[ -z "$NAME" ]] && { echo "Usage: $0 <name> <tier> [license_key]"; exit 1; }
echo "Provisioning operator: $NAME (tier: $TIER)"
if [[ -n "$KEY" ]]; then
  echo "  Verifying license key..."
  STATUS=$(curl -s "$(cat ~/.config/tmmt/supabase_url.txt 2>/dev/null)/rest/v1/operator_licenses?license_key=eq.$KEY&select=status,tier" \
    -H "apikey: $(cat ~/.config/tmmt/supabase_anon.txt 2>/dev/null)" 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0].get('status','invalid') if d else 'not_found')" 2>/dev/null || echo "unknown")
  echo "  License status: $STATUS"
fi
cat > "/tmp/operator-$NAME.env" <<OPENV
OPERATOR_NAME=$NAME
OPERATOR_TIER=$TIER
OPERATOR_LICENSE=$KEY
DEMO_MODE=$([[ "$TIER" == "TASTE" ]] && echo "true" || echo "false")
OPENV
chmod 600 "/tmp/operator-$NAME.env"
echo "  Env written: /tmp/operator-$NAME.env"
echo ""
printf "  Kill switch acknowledged? (y/N): "
read -r ACK
[[ "$ACK" == "y" || "$ACK" == "Y" ]] || { echo "  Operator must acknowledge kill switch. Aborting."; exit 1; }
echo "  ✓ Kill switch acknowledged"
echo "  ✓ Operator $NAME provisioned at tier $TIER"
