#!/usr/bin/env python3
"""Tailscale/local HTTP bridge — iPhone & carry Mac send TMMT commands without chat.db FDA."""
from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

CHANNEL = Path(__file__).resolve().parent
sys.path.insert(0, str(CHANNEL))

from command_router import dispatch_and_reply, load_dotenv, normalize_handle  # noqa: E402


def _auth_ok(headers: dict, qs: dict, body: dict) -> bool:
    secret = os.environ.get("REMOTE_CMD_SECRET", "").strip()
    if not secret:
        return False
    for src in (
        headers.get("Authorization", "").removeprefix("Bearer ").strip(),
        headers.get("X-TMMT-Secret", "").strip(),
        qs.get("secret", [""])[0],
        str(body.get("secret", "")),
    ):
        if src and src == secret:
            return True
    return False


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write(f"remote-cmd: {fmt % args}\n")

    def _json(self, code: int, obj: dict) -> None:
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        if urlparse(self.path).path == "/health":
            self._json(200, {"ok": True, "service": "tmmt-remote-cmd"})
            return
        self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path not in ("/cmd", "/"):
            self._json(404, {"ok": False, "error": "not found"})
            return

        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length).decode("utf-8", errors="ignore") if length else ""
        body: dict = {}
        if raw.strip():
            try:
                body = json.loads(raw)
            except json.JSONDecodeError:
                body = {"text": raw.strip()}

        qs = parse_qs(urlparse(self.path).query)
        if not _auth_ok(dict(self.headers), qs, body):
            self._json(401, {"ok": False, "error": "unauthorized"})
            return

        text = str(body.get("text") or body.get("command") or qs.get("text", [""])[0]).strip()
        if not text:
            self._json(400, {"ok": False, "error": "missing text/command"})
            return

        reply_to = body.get("reply_to") or os.environ.get("IMESSAGE_BUDDY", "")
        reply_to = normalize_handle(str(reply_to)) if reply_to else ""

        if reply_to and os.environ.get("REMOTE_REPLY_IMESSAGE", "1") != "0":
            result = dispatch_and_reply(text, reply_to)
        else:
            from command_router import dispatch

            result = dispatch(text)

        self._json(
            200 if result.ok else 500,
            {"ok": result.ok, "summary": result.summary, "detail": result.detail[:2000]},
        )


def main() -> None:
    load_dotenv()
    secret = os.environ.get("REMOTE_CMD_SECRET", "").strip()
    if not secret:
        print("REMOTE_CMD_SECRET missing in .env", file=sys.stderr)
        sys.exit(1)

    host = os.environ.get("REMOTE_CMD_HOST", "0.0.0.0").strip()
    port = int(os.environ.get("REMOTE_CMD_PORT", "9876"))
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"remote-cmd listening on {host}:{port}", file=sys.stderr)
    server.serve_forever()


if __name__ == "__main__":
    main()
