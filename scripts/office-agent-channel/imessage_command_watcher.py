#!/usr/bin/env python3
"""
Optional: poll local Messages database for inbound commands from allow-listed handles.
Requires Full Disk Access for Terminal/python3 that runs this script.

Prefix messages with IMESSAGE_CMD_PREFIX (default "TMMT ") e.g. "TMMT pull_flash"

NOT officially supported by Apple — schema can change. Use Telegram for production.
"""
from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
STATE_DIR = Path(os.path.expanduser("~/Library/Application Support/TMMT"))
STATE_FILE = STATE_DIR / "imessage-watcher.rowid"
CHAT_DB = Path(os.path.expanduser("~/Library/Messages/chat.db"))


def load_dotenv() -> None:
    p = Path(__file__).resolve().parent / ".env"
    if not p.is_file():
        return
    for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


def allowed_handles() -> set[str]:
    raw = os.environ.get("IMESSAGE_ALLOWED_HANDLES", "").strip()
    return {x.strip() for x in raw.split(",") if x.strip()}


def prefix() -> str:
    p = os.environ.get("IMESSAGE_CMD_PREFIX", "TMMT").strip()
    return p if p.endswith(" ") else p + " "


def last_rowid() -> int:
    try:
        return int(STATE_FILE.read_text().strip())
    except Exception:
        return 0


def save_rowid(r: int) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(str(r), encoding="utf-8")


def run_cmd(name: str) -> None:
    if name == "pull_flash":
        subprocess.run(
            ["/bin/bash", "-lc", "TMMT_FORCE_FLASH_PULL=1 bash scripts/pull-from-flash-drives.sh"],
            cwd=str(REPO_ROOT),
            timeout=600,
        )
    elif name == "sync_flash":
        subprocess.run(
            ["/bin/bash", "-lc", "TMMT_FORCE_DOCK_SYNC=1 bash scripts/sync-all-flash-drives.sh"],
            cwd=str(REPO_ROOT),
            timeout=600,
        )
    elif name == "status":
        subprocess.run(
            ["/bin/bash", "-lc", "bash scripts/verify-office-services.sh"],
            cwd=str(REPO_ROOT),
            timeout=120,
        )


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
        print(f"Missing {CHAT_DB} — is Messages set up?", file=sys.stderr)
        sys.exit(1)

    pref = prefix()
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
            print(f"imessage_command_watcher: init ROWID cursor at {last} (skip backlog)", file=sys.stderr)
        except sqlite3.Error as e:
            print("sqlite init:", e, file=sys.stderr)

    print(f"imessage_command_watcher: last ROWID {last}, prefix {pref!r}", file=sys.stderr)

    while True:
        try:
            conn = sqlite3.connect(uri, uri=True)
            cur = conn.cursor()
            cur.execute(
                """
                SELECT m.ROWID, m.text, h.id
                FROM message m
                JOIN handle h ON m.handle_id = h.ROWID
                WHERE m.is_from_me = 0
                  AND m.text IS NOT NULL
                  AND m.ROWID > ?
                ORDER BY m.ROWID ASC
                LIMIT 50
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
            if hid not in handles:
                continue
            if not text or not text.strip().startswith(pref):
                continue
            body = text.strip()[len(pref) :].strip().split()
            if not body:
                continue
            cmd = body[0].lower().rstrip(".")
            if cmd in ("pull_flash", "sync_flash", "status"):
                print(f"run {cmd} from {hid} ROWID={rowid}", file=sys.stderr)
                try:
                    run_cmd(cmd)
                except Exception as e:
                    print("run error:", e, file=sys.stderr)
        if new_last != last:
            last = new_last
            save_rowid(last)

        time.sleep(15)


if __name__ == "__main__":
    main()
