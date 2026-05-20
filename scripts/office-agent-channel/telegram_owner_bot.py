#!/usr/bin/env python3
"""
Telegram allow-listed owner bot for the office Mac.
Long-poll Telegram; runs TMMT shell helpers (pull/sync flash, status).

Env (load from .env via load_env in __main__ or export before launch):
  TELEGRAM_BOT_TOKEN        required
  TELEGRAM_ALLOWED_CHAT_IDS comma-separated; empty = deny all
  IMESSAGE_BUDDY            optional confirmations
  TELEGRAM_REPLY_IMESSAGE   1 to also iMessage boss on each command
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CHANNEL = Path(__file__).resolve().parent
IMESSAGE_SEND = CHANNEL / "imessage_send.sh"


def tg_call(method: str, **params: str | int) -> dict:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        print("TELEGRAM_BOT_TOKEN missing", file=sys.stderr)
        sys.exit(1)
    q = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    url = f"https://api.telegram.org/bot{token}/{method}?{q}"
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def send_message(chat_id: int, text: str) -> None:
    tg_call("sendMessage", chat_id=str(chat_id), text=text[:4000])


def allowed(chat_id: int) -> bool:
    raw = os.environ.get("TELEGRAM_ALLOWED_CHAT_IDS", "").strip()
    if not raw:
        return False
    ids = {x.strip() for x in raw.split(",") if x.strip()}
    return str(chat_id) in ids


def run_bash(script: str, extra_env: dict | None = None) -> tuple[int, str]:
    env = os.environ.copy()
    env.setdefault("TMMT_REPO_ROOT", str(REPO_ROOT))
    if extra_env:
        env.update(extra_env)
    p = subprocess.run(
        ["/bin/bash", "-lc", script],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        timeout=600,
        env=env,
    )
    out = (p.stdout or "") + (p.stderr or "")
    return p.returncode, out[-3500:]


def maybe_imessage(text: str) -> None:
    if os.environ.get("TELEGRAM_REPLY_IMESSAGE", "").strip() != "1":
        return
    buddy = os.environ.get("IMESSAGE_BUDDY", "").strip()
    if not buddy or not IMESSAGE_SEND.is_file():
        return
    env = os.environ.copy()
    env["IMESSAGE_BUDDY"] = buddy
    subprocess.run(
        ["/bin/bash", str(IMESSAGE_SEND), text[:4000]],
        cwd=str(CHANNEL),
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )


def handle_text(chat_id: int, text: str) -> None:
    parts = text.strip().split(maxsplit=1)
    cmd = parts[0].lower()
    arg = parts[1] if len(parts) > 1 else ""

    if cmd in ("/start", "/help"):
        send_message(
            chat_id,
            "TMMT office bot — allow-listed commands:\n"
            "/pull_flash — copy USB → ~/Documents/TMMT-Flash-Inbox/current/\n"
            "/sync_flash — push ~/dev → mounted flash drives\n"
            "/status — office services health\n"
            "/say <text> — send iMessage to IMESSAGE_BUDDY (if set)\n"
            "/help",
        )
        return

    if cmd == "/pull_flash":
        code, out = run_bash("TMMT_FORCE_FLASH_PULL=1 bash scripts/pull-from-flash-drives.sh")
        send_message(chat_id, f"pull_flash exit {code}\n```\n{out}\n```"[:4000])
        maybe_imessage("TMMT: pull_flash completed.")
        return

    if cmd == "/sync_flash":
        code, out = run_bash("TMMT_FORCE_DOCK_SYNC=1 bash scripts/sync-all-flash-drives.sh")
        send_message(chat_id, f"sync_flash exit {code}\n```\n{out}\n```"[:4000])
        maybe_imessage("TMMT: sync_flash completed.")
        return

    if cmd == "/status":
        code, out = run_bash("bash scripts/verify-office-services.sh")
        send_message(chat_id, f"status exit {code}\n```\n{out}\n```"[:4000])
        return

    if cmd == "/say":
        buddy = os.environ.get("IMESSAGE_BUDDY", "").strip()
        if not buddy or not arg:
            send_message(chat_id, "Set IMESSAGE_BUDDY and pass text: /say hello")
            return
        env = os.environ.copy()
        env["IMESSAGE_BUDDY"] = buddy
        r = subprocess.run(
            ["/bin/bash", str(IMESSAGE_SEND), arg[:4000]],
            cwd=str(CHANNEL),
            env=env,
            capture_output=True,
            text=True,
            timeout=60,
        )
        send_message(
            chat_id,
            f"iMessage send exit {r.returncode}\n{(r.stderr or r.stdout or '')[:2000]}",
        )
        return

    send_message(chat_id, "Unknown command. /help")


def load_dotenv() -> None:
    env_file = CHANNEL / ".env"
    if not env_file.is_file():
        return
    for line in env_file.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


def main() -> None:
    load_dotenv()
    offset = 0
    print("telegram_owner_bot: polling…", file=sys.stderr)
    while True:
        try:
            data = tg_call("getUpdates", offset=offset, timeout=50)
        except urllib.error.URLError as e:
            print("network:", e, file=sys.stderr)
            time.sleep(5)
            continue
        except Exception as e:
            print("error:", e, file=sys.stderr)
            time.sleep(5)
            continue

        for u in data.get("result", []):
            offset = max(offset, int(u["update_id"]) + 1)
            msg = u.get("message") or u.get("edited_message")
            if not msg:
                continue
            chat = msg.get("chat") or {}
            chat_id = int(chat.get("id", 0))
            text = (msg.get("text") or "").strip()
            if not text:
                continue
            if not allowed(chat_id):
                send_message(chat_id, "This bot is locked to allow-listed chat IDs.")
                continue
            try:
                handle_text(chat_id, text)
            except Exception as e:
                send_message(chat_id, f"Error: {e!s}"[:500])


if __name__ == "__main__":
    main()
