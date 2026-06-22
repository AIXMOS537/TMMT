#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FACE_DIR="$ROOT/.aixmos/face"
VENV="$FACE_DIR/venv"
G=$'\e[32m'; Y=$'\e[33m'; C=$'\e[36m'; BD=$'\e[1m'; RST=$'\e[0m'
ok()  { printf '  %s✓%s %s\n' "$G" "$RST" "$*"; }
warn(){ printf '  %s!%s %s\n' "$Y" "$RST" "$*"; }
say() { printf '\n%s%s%s\n' "$BD" "$*" "$RST"; }
info(){ printf '  %s›%s %s\n' "$C" "$RST" "$*"; }

mkdir -p "$FACE_DIR/portraits" "$FACE_DIR/voice-samples" "$HOME/.config/tmmt/logs"

say "1. Python venv"
PY=$(command -v python3)
[[ ! -d "$VENV" ]] && $PY -m venv "$VENV"
source "$VENV/bin/activate"
pip install --quiet --upgrade pip
ok "venv ready"

say "2. PyTorch (Apple Silicon MPS)"
python -c "import torch" 2>/dev/null || pip install --quiet torch torchvision torchaudio
python -c "import torch; print('  MPS:', torch.backends.mps.is_available())"
ok "PyTorch ready"

say "3. Core libs"
pip install --quiet insightface onnxruntime opencv-python-headless flask ffmpeg-python numpy pillow requests huggingface_hub
ok "Core libs ready"

say "4. OpenVoice v2"
OV="$FACE_DIR/OpenVoice"
if [[ ! -d "$OV" ]]; then
  git clone --depth 1 https://github.com/myshell-ai/OpenVoice.git "$OV" 2>/dev/null && ok "OpenVoice cloned" || warn "Clone failed"
fi
[[ -d "$OV" ]] && pip install --quiet -e "$OV" 2>/dev/null || true
if [[ -d "$OV" && ! -d "$OV/checkpoints_v2" ]]; then
  info "Downloading OpenVoice checkpoints (~500MB)..."
  python -c "from huggingface_hub import snapshot_download; snapshot_download('myshell-ai/OpenVoice', local_dir='$OV/checkpoints_v2')" 2>/dev/null \
    && ok "OpenVoice checkpoints ready" || warn "Manual: huggingface-cli download myshell-ai/OpenVoice"
else
  [[ -d "$OV" ]] && ok "OpenVoice ready"
fi

say "5. LivePortrait"
LP="$FACE_DIR/LivePortrait"
if [[ ! -d "$LP" ]]; then
  git clone --depth 1 https://github.com/KwaiVision/LivePortrait.git "$LP" 2>/dev/null \
  || git clone --depth 1 https://github.com/cleardusk/LivePortrait.git "$LP" 2>/dev/null \
  || warn "LivePortrait clone failed"
fi
[[ -f "$LP/requirements.txt" ]] && pip install --quiet -r "$LP/requirements.txt" 2>/dev/null || true
if [[ -d "$LP" && ! -d "$LP/pretrained_weights" ]]; then
  info "Downloading LivePortrait weights (~2GB)..."
  python -c "from huggingface_hub import snapshot_download; snapshot_download('KwaiVision/LivePortrait', local_dir='$LP/pretrained_weights')" 2>/dev/null \
    && ok "LivePortrait weights ready" || warn "Weights download pending"
else
  [[ -d "$LP" ]] && ok "LivePortrait ready"
fi
command -v ffmpeg >/dev/null 2>&1 || brew install ffmpeg 2>/dev/null

say "6. Face inference server"
cat > "$FACE_DIR/aria_face_server.py" << 'PYEOF'
#!/usr/bin/env python3
import os, sys, json, tempfile, subprocess
from pathlib import Path
from flask import Flask, request, jsonify, send_file

app = Flask(__name__)
FACE_DIR   = Path(__file__).parent
ACTIVE_PIC = FACE_DIR / "active_portrait.jpg"
ACTIVE_WAV = FACE_DIR / "active_voice_sample.wav"

@app.route('/health')
def health():
    return jsonify({"status":"ready" if ACTIVE_PIC.exists() and ACTIVE_WAV.exists() else "needs_setup",
                    "portrait":str(ACTIVE_PIC) if ACTIVE_PIC.exists() else None,
                    "voice":str(ACTIVE_WAV) if ACTIVE_WAV.exists() else None,
                    "liveportrait":(FACE_DIR/"LivePortrait").exists(),
                    "openvoice":(FACE_DIR/"OpenVoice").exists()})

@app.route('/set-portrait', methods=['POST'])
def set_portrait():
    f=request.files.get('file')
    if not f: return jsonify({"error":"No file"}),400
    f.save(str(ACTIVE_PIC)); return jsonify({"ok":True})

@app.route('/set-voice', methods=['POST'])
def set_voice():
    f=request.files.get('file')
    if not f: return jsonify({"error":"No file"}),400
    tmp=FACE_DIR/"voice_tmp"
    f.save(str(tmp))
    subprocess.run(["ffmpeg","-y","-i",str(tmp),"-ar","16000","-ac","1",str(ACTIVE_WAV)],capture_output=True)
    tmp.unlink(missing_ok=True)
    return jsonify({"ok":True})

@app.route('/extract-portrait', methods=['POST'])
def extract_portrait():
    f=request.files.get('file')
    if not f: return jsonify({"error":"No file"}),400
    with tempfile.TemporaryDirectory() as tmp:
        path=os.path.join(tmp,f.filename or "upload")
        f.save(path)
        try:
            import cv2
            from insightface.app import FaceAnalysis
            fa=FaceAnalysis(providers=['CoreMLExecutionProvider','CPUExecutionProvider'])
            fa.prepare(ctx_id=0,det_size=(640,640))
            ext=os.path.splitext(path)[1].lower()
            if ext in ['.mp4','.mov','.avi','.webm']:
                cap=cv2.VideoCapture(path); frames=[]; i=0
                while cap.isOpened():
                    ret,fr=cap.read()
                    if not ret: break
                    if i%10==0: frames.append(fr)
                    i+=1
                cap.release()
            else:
                frames=[cv2.imread(path)]
            best,best_score=None,0
            for fr in frames:
                if fr is None: continue
                for face in fa.get(fr):
                    s=float(face.det_score)*(face.bbox[2]-face.bbox[0])*(face.bbox[3]-face.bbox[1])
                    if s>best_score: best_score,best=s,fr
            if best is not None:
                cv2.imwrite(str(ACTIVE_PIC),best)
                return jsonify({"ok":True,"score":float(best_score)})
            return jsonify({"error":"No face detected"}),422
        except Exception as e:
            return jsonify({"error":str(e)}),500

@app.route('/synthesize', methods=['POST'])
def synthesize():
    text=(request.get_json() or {}).get("text","")
    if not text: return jsonify({"error":"No text"}),400
    out=FACE_DIR/"tts_output.wav"
    try:
        sys.path.insert(0,str(FACE_DIR/"OpenVoice"))
        from melo.api import TTS
        from openvoice import se_extractor
        from openvoice.api import ToneColorConverter
        model=TTS(language='EN',device='auto')
        spk_id=list(model.hps.data.spk2id.values())[0]
        tmp_wav=FACE_DIR/"tts_base.wav"
        model.tts_to_file(text,spk_id,str(tmp_wav),speed=1.0)
        if ACTIVE_WAV.exists():
            ckpt=FACE_DIR/"OpenVoice"/"checkpoints_v2"/"converter"
            conv=ToneColorConverter(str(ckpt/"config.json"),device='auto')
            conv.load_ckpt(str(ckpt/"checkpoint.pth"))
            tgt,_=se_extractor.get_se(str(ACTIVE_WAV),conv,vad=False)
            src,_=se_extractor.get_se(str(tmp_wav),conv,vad=False)
            conv.convert(audio_src_path=str(tmp_wav),src_se=src,tgt_se=tgt,output_path=str(out),tau=0.3)
            tmp_wav.unlink(missing_ok=True)
        else:
            tmp_wav.rename(out)
        return send_file(str(out),mimetype='audio/wav')
    except Exception as e:
        return jsonify({"error":str(e)}),500

@app.route('/animate', methods=['POST'])
def animate():
    audio=request.files.get('audio')
    if not audio: return jsonify({"error":"No audio"}),400
    if not ACTIVE_PIC.exists(): return jsonify({"error":"No portrait"}),422
    with tempfile.TemporaryDirectory() as tmp:
        ap=os.path.join(tmp,"audio.wav"); out=os.path.join(tmp,"out.mp4")
        audio.save(ap)
        try:
            lp=FACE_DIR/"LivePortrait"
            subprocess.run([sys.executable,str(lp/"inference.py"),
                "--source_image",str(ACTIVE_PIC),"--driving_audio",ap,
                "--output",out,"--device","mps"],
                capture_output=True,cwd=str(lp))
            if os.path.exists(out):
                return send_file(out,mimetype='video/mp4')
        except: pass
        return jsonify({"error":"animation failed","fallback":"audio-only"}),200

if __name__=='__main__':
    PORT=int(os.environ.get('ARIA_FACE_PORT',7788))
    print(f"ARIA Face Server → http://localhost:{PORT}")
    app.run(host='127.0.0.1',port=PORT,debug=False)
PYEOF

chmod +x "$FACE_DIR/aria_face_server.py"
ok "Face server written"

say "7. LaunchAgent (auto-start)"
PLIST="$HOME/Library/LaunchAgents/com.aixmos.aria.face.plist"
launchctl bootout "gui/$(id -u)/com.aixmos.aria.face" 2>/dev/null || true
cat > "$PLIST" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.aixmos.aria.face</string>
  <key>ProgramArguments</key><array>
    <string>$VENV/bin/python</string>
    <string>$FACE_DIR/aria_face_server.py</string>
  </array>
  <key>WorkingDirectory</key><string>$FACE_DIR</string>
  <key>EnvironmentVariables</key><dict>
    <key>ARIA_FACE_PORT</key><string>7788</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardOutPath</key><string>$HOME/.config/tmmt/logs/aria-face.log</string>
  <key>StandardErrorPath</key><string>$HOME/.config/tmmt/logs/aria-face.err</string>
  <key>ThrottleInterval</key><integer>15</integer>
</dict></plist>
PLIST
launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null && ok "Face server LaunchAgent armed" || warn "LaunchAgent failed — will start manually"

deactivate
echo ""
echo "  ✓ DONE. Face + voice stack installed."
echo "  Drop photos → .aixmos/face/portraits/"
echo "  Drop audio  → .aixmos/face/voice-samples/"
echo "  Then: open http://localhost:4200 → click setup"
