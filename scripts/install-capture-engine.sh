#!/bin/bash
# install-capture-engine.sh — one-shot AIXMOS Capture Engine install for any Mac.
# Installs deps (ffmpeg + whisper.cpp via Homebrew), pulls the local model,
# lays the voice-inbox watcher + launchd job. Everything runs on-device;
# nothing leaves the machine.
#
# Usage: bash install-capture-engine.sh
# Run from a folder that also contains voice-inbox-watch.sh (repo scripts/
# or a wave4 handoff package copy).

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
[ -f "$DIR/voice-inbox-watch.sh" ] || { echo "voice-inbox-watch.sh not found next to installer"; exit 1; }

command -v brew >/dev/null 2>&1 || { echo "Homebrew required first: https://brew.sh"; exit 1; }
brew list ffmpeg >/dev/null 2>&1 || brew install ffmpeg
brew list whisper-cpp >/dev/null 2>&1 || brew install whisper-cpp

MODEL_DIR="$HOME/.cache/whisper-models"
MODEL="$MODEL_DIR/ggml-small.en.bin"
mkdir -p "$MODEL_DIR"
if [ ! -f "$MODEL" ]; then
  echo "Downloading whisper model (ggml-small.en, ~466MB, one time)..."
  curl -L --fail -o "$MODEL" \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin"
fi

# Prefer the repo copy (survives via git); standalone machines get ~/.local/bin.
if [ -d "$HOME/Projects/TMMT/scripts" ]; then
  TARGET="$HOME/Projects/TMMT/scripts/voice-inbox-watch.sh"
else
  mkdir -p "$HOME/.local/bin"
  TARGET="$HOME/.local/bin/voice-inbox-watch.sh"
fi
cp "$DIR/voice-inbox-watch.sh" "$TARGET"
chmod +x "$TARGET"

PLIST="$HOME/Library/LaunchAgents/com.tmmt.voice-inbox.plist"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.tmmt.voice-inbox</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$TARGET</string>
  </array>
  <key>StartInterval</key><integer>30</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>/tmp/voice-inbox.log</string>
  <key>StandardErrorPath</key><string>/tmp/voice-inbox.err</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo
echo "✅ Capture Engine live on $(hostname)."
echo "Drop points:"
echo "  tasks     -> ~/.tmmt/inbox            (+ iCloud Drive/VoiceDrop)"
echo "  knowledge -> ~/.tmmt/media-inbox      (+ iCloud Drive/MediaDrop)"
echo "Transcripts -> ~/Brain/vault/99-Inbox/{voice,media}-transcripts/"
echo "Logs: /tmp/voice-inbox.log · errors: /tmp/voice-inbox.err"
echo "Note: the task lane needs the TMMT repo + Ollama for board routing;"
echo "without them, transcripts still save — files park in ~/.tmmt/inbox-failed."
