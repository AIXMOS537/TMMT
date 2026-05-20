#!/bin/bash
cd "$HOME/dev/TMMT" || exit 1
bash ./scripts/enable-office-services.sh
echo ""
echo "Press Enter to close..."
read -r
