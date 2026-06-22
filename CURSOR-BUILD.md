# ARIA Face + Voice — Cursor Build Brief

Hand this file to Cursor. Everything it needs to finish the build is here.

---

## What exists (already built, do not rebuild)

- `aria/` — Next.js 14 app, port 4200, black/cyan UI, chat interface
- `aria/app/api/chat/route.ts` — local Ollama (`qwen2.5:14b`) → Claude Haiku fallback
- `aria/app/api/voice/route.ts` — local OpenVoice → ElevenLabs → browser TTS cascade
- `scripts/aria-face-setup.sh` — installs LivePortrait + OpenVoice + InsightFace into `.aixmos/face/venv`
- `scripts/aria-train-face.sh` — picks best portrait from photos/videos via InsightFace
- `scripts/aria-train-voice.sh` — registers voice sample for OpenVoice cloning
- `.aixmos/face/aria_face_server.py` — Flask inference server on port 7788
  - `GET  /health` — status
  - `POST /set-portrait` — set active face image
  - `POST /set-voice` — set voice sample
  - `POST /extract-portrait` — best-frame extraction from photo/video upload
  - `POST /synthesize` — text → cloned voice WAV
  - `POST /animate` — portrait + audio → lip-synced MP4

---

## What Cursor needs to build

### 1. `aria/app/api/avatar/route.ts`
POST endpoint. Accepts `{ text }`. Calls `/api/voice` to get audio, then sends audio to face server `/animate`. Returns the video as a stream or a URL to a temp file served via `/api/avatar/[file]`.

```
POST /api/avatar
Body: { text: string }
Returns: video/mp4 stream  (or { videoUrl: string } if streaming is hard)
```

Face server is at `http://127.0.0.1:7788`. Voice route is at `http://localhost:4200/api/voice`.

Timeout: 30 seconds (animation takes 5-15s).

Fallback: if face server is down or returns error, return `{ fallback: true, audioOnly: true }` with the WAV audio attached.

---

### 2. `aria/components/ARIAAvatar.tsx`

React component. Replaces the `✦` placeholder in `aria/app/page.tsx`.

**Behavior:**
- Default state: shows a still portrait image (`/api/avatar/portrait` — see route below)
- When ARIA is responding: fetches `/api/avatar` with the response text, plays the returned video
- While video plays: the face is animated and lip-synced
- After video ends: returns to still portrait
- If no portrait set: shows the `✦` symbol (current behavior)
- If face server down: shows `✦` and plays audio only via `<audio>` tag

**Props:**
```tsx
interface ARIAAvatarProps {
  responding: boolean
  responseText: string
  onSpeechEnd: () => void
}
```

**Style:** circular or portrait-shaped frame, same cyan `#0ff` border glow as the rest of the UI. Centered above the chat.

---

### 3. `aria/app/api/avatar/portrait/route.ts`

GET endpoint. Returns the active portrait image from `.aixmos/face/active_portrait.jpg`.

```
GET /api/avatar/portrait
Returns: image/jpeg  (200) or 404 if no portrait set
```

Path to image: `process.cwd() + '/../.aixmos/face/active_portrait.jpg'` (TMMT root is one level up from `aria/`).

---

### 4. Update `aria/app/page.tsx`

- Import `ARIAAvatar`
- Replace `<div className="...">✦</div>` with `<ARIAAvatar responding={isResponding} responseText={lastResponse} onSpeechEnd={() => setIsResponding(false)} />`
- Add state: `const [isResponding, setIsResponding] = useState(false)`
- Add state: `const [lastResponse, setLastResponse] = useState('')`
- When a response comes back from `/api/chat`: set `lastResponse` to the content, set `isResponding = true`
- `onSpeechEnd` sets `isResponding = false`

---

### 5. `aria/components/ARIASetup.tsx` (optional but nice)

Small setup UI shown when no portrait is detected (`/api/avatar/portrait` returns 404).

Shows two upload buttons:
- "Upload face photo/video" → POST to `http://localhost:7788/extract-portrait`
- "Upload voice sample" → POST to `http://localhost:7788/set-voice`

After both uploads succeed, reload the page.

This replaces the manual terminal steps for non-technical users.

---

## File structure reference

```
~/Projects/TMMT/
├── aria/
│   ├── app/
│   │   ├── page.tsx              ← UPDATE THIS
│   │   ├── layout.tsx
│   │   └── api/
│   │       ├── chat/route.ts     ← exists
│   │       ├── voice/route.ts    ← exists
│   │       └── avatar/
│   │           ├── route.ts      ← BUILD THIS
│   │           └── portrait/
│   │               └── route.ts  ← BUILD THIS
│   ├── components/
│   │   ├── ARIAAvatar.tsx        ← BUILD THIS
│   │   └── ARIASetup.tsx         ← BUILD THIS (optional)
│   └── package.json
└── .aixmos/
    └── face/
        ├── active_portrait.jpg   ← set by aria-train-face.sh
        ├── active_voice_sample.wav ← set by aria-train-voice.sh
        └── aria_face_server.py   ← Flask server on :7788
```

---

## Rules

- No new dependencies unless absolutely required. `next`, `react`, standard browser APIs only.
- No ElevenLabs or external API calls in these new files. Face server is 100% local.
- TypeScript strict. No `any`.
- Tailwind classes only for styling. Colors: background `#000`, accent `#0ff`, text `#fff`.
- Face server runs on `http://127.0.0.1:7788` — never exposed externally.
- If face server is unreachable, degrade gracefully (audio only or text only). Never crash.
- Keep the existing chat functionality working exactly as-is.

---

## Test when done

```bash
# 1. Start face server
source .aixmos/face/venv/bin/activate
python3 .aixmos/face/aria_face_server.py &

# 2. Add a test portrait
curl -X POST http://localhost:7788/set-portrait -F "file=@/path/to/any/photo.jpg"

# 3. Build + start ARIA
cd aria && npm run build && npm start

# 4. Open http://localhost:4200
# Send a message — face should animate with the response
```
