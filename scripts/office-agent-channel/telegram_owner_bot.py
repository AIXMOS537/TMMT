#!/usr/bin/env python3
"""Telegram allow-listed bot → unified command_router."""
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

CHANNEL = Path(__file__).resolve().parent
sys.path.insert(0, str(CHANNEL))

from command_router import dispatch, load_dotenv  # noqa: E402

IMESSAGE_SEND = CHANNEL / "imessage_send.sh"


def tg_call(method: str, **params: str | int) -> dict:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        print("TELEGRAM_BOT_TOKEN missing", file=sys.stderr)
        sys.exit(1)
    q = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    url = f"https://api.telegram.org/bot{token}/{method}?{q}"
    with urllib.request.urlopen(urllib.request.Request(url), timeout=60) as resp:
        return json.loads(resp.read().decode())


def tg_send(chat_id: int, text: str) -> None:
    tg_call("sendMessage", chat_id=str(chat_id), text=text[:4000])


def allowed(chat_id: int) -> bool:
    raw = os.environ.get("TELEGRAM_ALLOWED_CHAT_IDS", "").strip()
    if not raw:
        return False
    return str(chat_id) in {x.strip() for x in raw.split(",") if x.strip()}


def maybe_imessage_ping(summary: str) -> None:
    if os.environ.get("TELEGRAM_REPLY_IMESSAGE", "").strip() != "1":
        return
    buddy = os.environ.get("IMESSAGE_BUDDY", "").strip()
    if not buddy or not IMESSAGE_SEND.is_file():
        return
    env = os.environ.copy()
    env["IMESSAGE_BUDDY"] = buddy
    subprocess.run(
        ["/bin/bash", str(IMESSAGE_SEND), f"TMMT: {summary}"[:4000]],
        cwd=str(CHANNEL),
        env=env,
        capture_output=True,
        timeout=60,
    )


def handle_text(chat_id: int, text: str) -> None:
    result = dispatch(text, channel="telegram")
    prefix = "OK" if result.ok else "ERR"
    msg = f"{prefix}: {result.summary}"
    tg_send(chat_id, msg)
    if result.detail and len(result.detail) < 3000:
        tg_send(chat_id, result.detail[:3500])
    maybe_imessage_ping(result.summary)


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
            chat_id = int((msg.get("chat") or {}).get("id", 0))
            body = (msg.get("text") or "").strip()
            if not body:
                continue
            if not allowed(chat_id):
                tg_send(chat_id, "This bot is locked to allow-listed chat IDs.")
                continue
            try:
                handle_text(chat_id, body)
            except Exception as e:
                tg_send(chat_id, f"Error: {e!s}"[:500])


if __name__ == "__main__":
    main()
