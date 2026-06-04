#!/usr/bin/env python3
"""
Poll Messages chat.db for TMMT commands from allow-listed handles; reply on iMessage.
"""
from __future__ import annotations

import os
import sqlite3
import sys
import time
from pathlib import Path

CHANNEL = Path(__file__).resolve().parent
sys.path.insert(0, str(CHANNEL))

from command_router import dispatch_and_reply, load_dotenv, normalize_handle  # noqa: E402

STATE_DIR = Path(os.path.expanduser("~/Library/Application Support/TMMT"))
STATE_FILE = STATE_DIR / "imessage-watcher.rowid"
CHAT_DB = Path(os.path.expanduser("~/Library/Messages/chat.db"))


def allowed_handles() -> set[str]:
    raw = os.environ.get("IMESSAGE_ALLOWED_HANDLES", "").strip()
    out = set()
    for h in raw.split(","):
        h = h.strip()
        if h:
            out.add(normalize_handle(h))
            out.add(h)
    return out


def last_rowid() -> int:
    try:
        return int(STATE_FILE.read_text().strip())
    except Exception:
        return 0


def save_rowid(r: int) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(str(r), encoding="utf-8")


def main() -> None:
    load_dotenv()
    if os.environ.get("IMESSAGE_WATCHER_ENABLED", "").strip() != "1":
        print("IMESSAGE_WATCHER_ENABLED is not 1 — exiting.", file=sys.stderr)
        sys.exit(0)

    handles = allowed_handles()
    if not handles:
        print("IMESSAGE_ALLOWED_HANDLES empty — exiting.", file=sys.stderr)
        sys.exit(1)

    if not CHAT_DB.is_file():
        print(f"Missing {CHAT_DB}", file=sys.stderr)
        sys.exit(1)

    last = last_rowid()
    uri = f"file:{CHAT_DB.as_posix()}?mode=ro"

    if not STATE_FILE.is_file():
        try:
            conn = sqlite3.connect(uri, uri=True)
            cur = conn.cursor()
            cur.execute("SELECT IFNULL(MAX(ROWID),0) FROM message")
            last = int(cur.fetchone()[0])
            conn.close()
            save_rowid(last)
            print(f"imessage watcher: init at ROWID {last}", file=sys.stderr)
        except sqlite3.Error as e:
            print("sqlite init:", e, file=sys.stderr)

    pfx = os.environ.get("IMESSAGE_CMD_PREFIX", "TMMT").strip()
    print(f"imessage watcher: watching {handles!r} prefix {pfx!r}", file=sys.stderr)

    while True:
        try:
            conn = sqlite3.connect(uri, uri=True)
            cur = conn.cursor()
            cur.execute(
                """
                SELECT m.ROWID, m.text, h.id
                FROM message m
                JOIN handle h ON m.handle_id = h.ROWID
                WHERE m.is_from_me = 0 AND m.text IS NOT NULL AND m.ROWID > ?
                ORDER BY m.ROWID ASC LIMIT 20
                """,
                (last,),
            )
            rows = cur.fetchall()
            conn.close()
        except sqlite3.Error as e:
            print("sqlite:", e, file=sys.stderr)
            time.sleep(30)
            continue

        new_last = last
        for rowid, text, hid in rows:
            new_last = max(new_last, int(rowid))
            if hid not in handles and normalize_handle(hid) not in handles:
                continue
            raw = text.strip()
            p = os.environ.get("IMESSAGE_CMD_PREFIX", "TMMT").strip().upper()
            if not raw.upper().startswith(p):
                continue
            cmd_text = raw
            print(f"run: {cmd_text[:80]!r} from {hid}", file=sys.stderr)
            try:
                dispatch_and_reply(cmd_text, normalize_handle(hid) or hid)
            except Exception as e:
                print("dispatch error:", e, file=sys.stderr)

        if new_last != last:
            last = new_last
            save_rowid(last)

        time.sleep(15)


if __name__ == "__main__":
    main()
