#!/usr/bin/env python3
"""rick-chat — local Ollama chat client for Rick Sorkin (stdlib only, macOS-safe).

Talks to a local Ollama server (default http://localhost:11434) using /api/chat,
keeps a rolling history file so Rick remembers the conversation, and prints the
assistant reply to stdout. Owner-local; no cloud, no third party.

Usage:
  rick-chat.py --model qwen2.5:14b --system-file SYS.txt \
               --history ~/.rick/history.json --message "hey rick"

Exit codes: 0 ok · 2 cannot reach Ollama · 3 model missing · 1 other error.
"""
import argparse, json, os, sys, urllib.request, urllib.error

def load_history(path, cap=20):
    try:
        with open(path) as f:
            msgs = json.load(f)
        return msgs[-cap:] if isinstance(msgs, list) else []
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return []

def save_history(path, msgs, cap=20):
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(msgs[-cap:], f)
    except OSError:
        pass  # memory is best-effort; never crash the chat over it

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=os.environ.get("OLLAMA_URL", "http://localhost:11434"))
    ap.add_argument("--model", default=os.environ.get("RICK_MODEL", "qwen2.5:14b"))
    ap.add_argument("--system-file", required=True)
    ap.add_argument("--history", required=True)
    ap.add_argument("--message", required=True)
    ap.add_argument("--turn-note", default="")  # per-turn steer (e.g. owner-gate)
    a = ap.parse_args()

    try:
        with open(a.system_file) as f:
            system = f.read().strip()
    except OSError:
        system = "You are Rick Sorkin, a helpful local assistant."
    if a.turn_note:
        system += "\n\n[THIS TURN] " + a.turn_note

    history = load_history(a.history)
    messages = [{"role": "system", "content": system}] + history + \
               [{"role": "user", "content": a.message}]
    body = json.dumps({"model": a.model, "messages": messages, "stream": False}).encode()

    req = urllib.request.Request(a.url.rstrip("/") + "/api/chat", data=body,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        txt = e.read().decode(errors="ignore")
        if e.code == 404 or "not found" in txt.lower():
            sys.stderr.write("model-missing\n"); sys.exit(3)
        sys.stderr.write(f"ollama HTTP {e.code}: {txt}\n"); sys.exit(1)
    except (urllib.error.URLError, ConnectionError, OSError) as e:
        sys.stderr.write(f"unreachable: {e}\n"); sys.exit(2)

    reply = (data.get("message") or {}).get("content", "").strip()
    if not reply:
        sys.stderr.write("empty reply\n"); sys.exit(1)
    print(reply)
    save_history(a.history, history + [{"role": "user", "content": a.message},
                                       {"role": "assistant", "content": reply}])

if __name__ == "__main__":
    main()
