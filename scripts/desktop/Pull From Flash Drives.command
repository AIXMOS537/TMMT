#!/bin/bash
TMMT_FORCE_FLASH_PULL=1 exec bash "$HOME/dev/TMMT/scripts/pull-from-flash-drives.sh"
echo ""
echo "Inbox: ~/Documents/TMMT-Flash-Inbox/current/"
echo "Log: ~/Library/Logs/tmmt-flash-usb-pull.log"
echo "Press Enter to close..."
read -r
