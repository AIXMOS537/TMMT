#!/bin/bash
# Foreground dev server (if LaunchAgent is not used). Binds 0.0.0.0:3000 for Tailscale.
exec bash "$HOME/dev/TMMT/scripts/office-dev-server.sh"
