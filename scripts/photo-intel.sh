#!/usr/bin/env bash
#
# photo-intel.sh — local, private image intelligence for HAILMARY.
#
# Scans images that have landed on THIS Mac (Photos/iCloud export, OneDrive,
# Downloads, etc. — wherever TikTok/Snap/IG/FB/Telegram saves to your Camera
# Roll → iCloud → Mac), runs each through a LOCAL vision model (Ollama, nothing
# uploaded), and infers what the owner is focused on / trying to get done.
# Optionally writes the findings to the shared brain so the backend team sees the
# vision.
#
# PRIVACY: 100% local. Personal photos never leave the machine. Run only on your
# own device and your own library (you = test subject #1, then Moe with consent).
#
# Usage:
#   bash scripts/photo-intel.sh ~/Pictures --limit 40
#   bash scripts/photo-intel.sh "~/Library/CloudStorage/OneDrive-Personal/Pictures" --limit 50 --push
#
# Requires: Ollama with a vision model -> `ollama pull llama3.2-vision`
#           (override with OLLAMA_VISION_MODEL). macOS `sips` handles HEIC.
set -euo pipefail

DIR="${1:-$HOME/Pictures}"
DIR="${DIR/#\~/$HOME}"
LIMIT=40
PUSH=""
shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --limit) LIMIT="${2:-40}"; shift 2;;
    --push) PUSH="1"; shift;;
    *) shift;;
  esac
done

OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
MODEL="${OLLAMA_VISION_MODEL:-llama3.2-vision}"
STATE="$HOME/.hailmary/photo-intel-seen.txt"
mkdir -p "$HOME/.hailmary"; touch "$STATE"
[ -f "$HOME/.hailmary/config.env" ] && . "$HOME/.hailmary/config.env" || true

command -v python3 >/dev/null || { echo "need python3"; exit 1; }
[ -d "$DIR" ] || { echo "Folder not found: $DIR"; exit 1; }
curl -fsS "$OLLAMA_URL/api/tags" >/dev/null 2>&1 || { echo "Ollama not reachable at $OLLAMA_URL — start it / install the vision model."; exit 1; }

echo "▸ Scanning $DIR (local vision: $MODEL, limit $LIMIT) — nothing leaves this Mac."
FINDINGS="$(mktemp)"; count=0

analyze_one() {
  local img="$1" work="$1" tmpjpg="" reqfile resp out hash
  hash="$(shasum -a 256 "$img" 2>/dev/null | awk '{print $1}')"
  [ -n "$hash" ] || return 0
  grep -q "^$hash$" "$STATE" && return 0   # already processed (idempotent)

  case "${img##*.}" in
    heic|HEIC|heif|HEIF) tmpjpg="$(mktemp).jpg"; sips -s format jpeg "$img" --out "$tmpjpg" >/dev/null 2>&1 && work="$tmpjpg" || { echo "$hash" >>"$STATE"; return 0; } ;;
  esac

  reqfile="$(mktemp)"
  python3 - "$MODEL" "$work" "$reqfile" <<'PY'
import json,sys,base64
m,img,out=sys.argv[1:4]
b=base64.b64encode(open(img,'rb').read()).decode()
prompt=("Examine this image the owner saved. Return STRICT JSON only: "
        "{\"description\":\"\",\"text_seen\":\"\",\"topics\":[],\"inferred_intent\":\"\"} "
        "- description: one line; text_seen: any words/numbers visible; topics: 3-6 tags; "
        "inferred_intent: in plain English, what the owner seems to be trying to do/learn/buy/build from saving this.")
json.dump({"model":m,"prompt":prompt,"images":[b],"stream":False,"format":"json"}, open(out,'w'))
PY
  resp="$(curl -fsS "$OLLAMA_URL/api/generate" -H 'content-type: application/json' --data-binary @"$reqfile" 2>/dev/null || true)"
  rm -f "$reqfile" "$tmpjpg" 2>/dev/null || true
  out="$(printf '%s' "$resp" | python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("response","").strip())
except Exception: print("")' 2>/dev/null)"
  echo "$hash" >>"$STATE"
  [ -n "$out" ] || return 0
  printf '%s\n' "$out" >>"$FINDINGS"
  echo "  • $(basename "$img"): $(printf '%s' "$out" | python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("inferred_intent","")[:120])
except Exception: print("(parsed)")' 2>/dev/null)"
}

# iterate images safely (spaces ok)
while IFS= read -r -d '' img; do
  [ "$count" -ge "$LIMIT" ] && break
  analyze_one "$img" && count=$((count+1)) || true
done < <(find "$DIR" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.heic' -o -iname '*.webp' \) -print0 2>/dev/null)

echo "▸ Analyzed $count new image(s). Summarizing the owner's focus…"

# Roll the per-image findings into one plain-English vision summary (local LLM).
SUMMARY="$(python3 - "$FINDINGS" <<'PY'
import json,sys
rows=[]
for line in open(sys.argv[1]):
    line=line.strip()
    if not line: continue
    try: rows.append(json.loads(line))
    except Exception: pass
topics={}
intents=[]
for r in rows:
    for t in (r.get("topics") or []): topics[t.lower()]=topics.get(t.lower(),0)+1
    if r.get("inferred_intent"): intents.append(r["inferred_intent"])
top=sorted(topics.items(), key=lambda x:-x[1])[:12]
print(json.dumps({"count":len(rows),"top_topics":top,"intents":intents[:40]}))
PY
)"
TEXTMODEL="${OLLAMA_MODEL:-qwen2.5:14b}"
sreq="$(mktemp)"
python3 - "$TEXTMODEL" "$SUMMARY" "$sreq" <<'PY'
import json,sys
m,ctx,out=sys.argv[1:4]
prompt=("From these per-image findings (topics + inferred intents the owner saved), write a SHORT plain-English read of "
        "what the owner is focused on and trying to get done right now — their end goal/vision. No fluff. "
        "Then list the top 3 themes.\n\nFINDINGS JSON:\n"+ctx)
json.dump({"model":m,"prompt":prompt,"stream":False}, open(out,'w'))
PY
VISION="$(curl -fsS "$OLLAMA_URL/api/chat" -H 'content-type: application/json' -d "$(python3 -c 'import json,sys;print(json.dumps({"model":"'"$TEXTMODEL"'","stream":False,"messages":[{"role":"user","content":open(sys.argv[1]).read()}]}))' <(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["prompt"])' "$sreq"))" 2>/dev/null | python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("message",{}).get("content",""))
except Exception: print("")' 2>/dev/null || true)"
rm -f "$sreq" "$FINDINGS" 2>/dev/null || true

echo; echo "===== OWNER FOCUS / VISION (local read) ====="; printf '%s\n' "${VISION:-"(no summary — check Ollama text model)"}"; echo "============================================"

# Optional: write the read to the shared brain so the backend team sees it.
if [ -n "$PUSH" ] && [ -n "${MEMORY_API_URL:-}" ] && [ -n "${MEMORY_API_TOKEN:-}" ] && [ -n "$VISION" ]; then
  node_label="HAILMARY photo-intel @ $(hostname 2>/dev/null || echo mac)"
  body="$(python3 -c 'import json,sys;print(json.dumps({"op":"remember","action":"photo_intel","source":"agent","actorKind":"owner","actorLabel":sys.argv[1],"summary":("Owner focus from saved images: "+sys.argv[2])[:1900],"details":{"images":int(sys.argv[3])}}))' "$node_label" "$VISION" "$count")"
  curl -fsS -X POST "$MEMORY_API_URL" -H "authorization: Bearer $MEMORY_API_TOKEN" -H 'content-type: application/json' -d "$body" >/dev/null 2>&1 \
    && echo "✓ Pushed to the brain." || echo "! Push failed (check MEMORY_API_URL/TOKEN)."
fi
