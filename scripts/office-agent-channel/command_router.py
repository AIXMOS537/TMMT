#!/usr/bin/env python3
"""
Unified TMMT command router — Telegram, iMessage watcher, and CLI.

Prefixes:
  TMMT ops <natural language>   → POST /api/ops/command
  TMMT brain <problem>          → node ops/files/brain-quick.js
  TMMT status | pull_flash | sync_flash | help | say <text>

Telegram also accepts /ops, /brain, /status, etc.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

CHANNEL = Path(__file__).resolve().parent
_SCRIPTS = CHANNEL.parent
REPO_ROOT = Path(os.environ.get("TMMT_REPO_ROOT", _SCRIPTS.parent)).expanduser()
TMMT_OS = REPO_ROOT / "tmmt-os"
OPS_FILES = REPO_ROOT.parent / "ops" / "files"
if not OPS_FILES.is_dir():
    OPS_FILES = Path.home() / "dev" / "AIX_Command_Center" / "ops" / "files"
BRAIN_QUICK = OPS_FILES / "brain-quick.js"
IMESSAGE_SEND = CHANNEL / "imessage_send.sh"


@dataclass
class DispatchResult:
    ok: bool
    summary: str
    detail: str = ""


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


def load_ops_secret() -> str:
    for key in ("OPS_COMMAND_SECRET",):
        if os.environ.get(key, "").strip():
            return os.environ[key].strip()
    for path in (TMMT_OS / ".env.local", REPO_ROOT / ".env.cmdc.prod"):
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            if line.startswith("OPS_COMMAND_SECRET="):
                v = line.split("=", 1)[1].strip().strip('"').strip("'")
                if v:
                    return v
    return ""


def normalize_handle(raw: str) -> str:
    s = str(raw).strip().lstrip("@")
    if not s or "@" in s:
        return s
    if s.startswith("+"):
        return s
    digits = re.sub(r"\D", "", s)
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    return f"+{digits}" if digits else s


def parse_command(text: str) -> tuple[str, str]:
    t = text.strip()
    if not t:
        return "help", ""

    if t.startswith("/"):
        parts = t.split(maxsplit=1)
        cmd = parts[0].lower()
        rest = parts[1] if len(parts) > 1 else ""
        slash_map = {
            "/start": "help",
            "/help": "help",
            "/pull_flash": "pull_flash",
            "/sync_flash": "sync_flash",
            "/status": "status",
            "/ops": "ops",
            "/brain": "brain",
            "/say": "say",
        }
        return slash_map.get(cmd, "unknown"), rest

    prefix = os.environ.get("IMESSAGE_CMD_PREFIX", "TMMT").strip().upper()
    if t.upper().startswith(prefix):
        t = t[len(prefix) :].strip()

    parts = t.split(maxsplit=1)
    verb = parts[0].lower()
    rest = parts[1] if len(parts) > 1 else ""
    return verb, rest


def run_bash(script: str, timeout: int = 600) -> tuple[int, str]:
    env = os.environ.copy()
    env.setdefault("TMMT_REPO_ROOT", str(REPO_ROOT))
    repo = env["TMMT_REPO_ROOT"]
    wrapped = f'cd "{repo}" && {script}'
    p = subprocess.run(
        ["/bin/bash", "-lc", wrapped],
        cwd=repo,
        capture_output=True,
        text=True,
        timeout=timeout,
        env=env,
    )
    out = ((p.stdout or "") + (p.stderr or "")).strip()
    return p.returncode, out[-3500:]


def run_ops(message: str) -> DispatchResult:
    secret = load_ops_secret()
    if not secret:
        return DispatchResult(
            False,
            "OPS_COMMAND_SECRET missing in tmmt-os/.env.local",
        )
    url = os.environ.get("TMMT_OPS_URL", "http://127.0.0.1:3000/api/ops/command").strip()
    body = json.dumps({"message": message}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {secret}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err = e.read().decode(errors="ignore")[:500]
        return DispatchResult(False, f"ops HTTP {e.code}: {err}")
    except Exception as e:
        return DispatchResult(False, f"ops failed: {e}")

    results = data.get("results") or []
    msgs = [r.get("message", "") for r in results if r.get("message")]
    summary = "; ".join(msgs)[:400] if msgs else "ops ok (no messages)"
    ok = all(r.get("ok", True) for r in results) if results else True
    return DispatchResult(ok, summary, detail=json.dumps(data)[:2000])


def extract_team_message(brain_output: str) -> str:
    m = re.search(
        r"4\)\s*TEAM MESSAGE:\s*([\s\S]*?)(?=\n\s*5\)\s|$)",
        brain_output,
        re.I,
    ) or re.search(r"TEAM MESSAGE:\s*([\s\S]*?)(?=\n\s*5\)\s|$)", brain_output, re.I)
    return m.group(1).strip() if m else brain_output.strip()[:500]


def run_brain(problem: str) -> DispatchResult:
    if not BRAIN_QUICK.is_file():
        return DispatchResult(False, f"brain-quick.js not found at {BRAIN_QUICK}")
    env = os.environ.copy()
    env["TMMT_BRAIN_PROBLEM"] = problem
    p = subprocess.run(
        ["node", str(BRAIN_QUICK), problem],
        cwd=str(OPS_FILES),
        capture_output=True,
        text=True,
        timeout=int(os.environ.get("TMMT_BRAIN_TIMEOUT", "180")),
        env=env,
    )
    if p.returncode != 0:
        err = (p.stderr or p.stdout or "brain failed")[:400]
        return DispatchResult(False, f"brain exit {p.returncode}: {err}")
    try:
        data = json.loads(p.stdout.strip().splitlines()[-1])
        team = data.get("team_message") or extract_team_message(data.get("raw", ""))
        summary = (team or data.get("summary", "brain done"))[:400]
        return DispatchResult(True, summary, detail=data.get("raw", "")[:1500])
    except json.JSONDecodeError:
        raw = (p.stdout or "")[-500:]
        return DispatchResult(True, extract_team_message(raw)[:400] or "brain done", detail=raw)


def send_imessage(buddy: str, text: str) -> bool:
    buddy = normalize_handle(buddy)
    if not buddy or not text or not IMESSAGE_SEND.is_file():
        return False
    env = os.environ.copy()
    env["IMESSAGE_BUDDY"] = buddy
    r = subprocess.run(
        ["/bin/bash", str(IMESSAGE_SEND), text[:4000]],
        cwd=str(CHANNEL),
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    return r.returncode == 0


def dispatch(
    text: str,
    *,
    reply_handle: str | None = None,
    channel: str = "cli",
) -> DispatchResult:
    verb, arg = parse_command(text)

    if verb == "help":
        help_text = (
            "TMMT commands: status, pull_flash, sync_flash, "
            "ops <msg>, brain <problem>, say <text>"
        )
        return DispatchResult(True, help_text)

    if verb == "status":
        verify = REPO_ROOT / "scripts" / "verify-office-services.sh"
        code, out = run_bash(f'bash "{verify}"', timeout=120)
        return DispatchResult(code == 0, f"status exit {code}", detail=out)

    if verb == "pull_flash":
        pull = REPO_ROOT / "scripts" / "pull-from-flash-drives.sh"
        code, out = run_bash(f'TMMT_FORCE_FLASH_PULL=1 bash "{pull}"')
        return DispatchResult(code == 0, f"pull_flash exit {code}", detail=out)

    if verb == "sync_flash":
        sync = REPO_ROOT / "scripts" / "sync-all-flash-drives.sh"
        code, out = run_bash(f'TMMT_FORCE_DOCK_SYNC=1 bash "{sync}"')
        return DispatchResult(code == 0, f"sync_flash exit {code}", detail=out)

    if verb == "ops":
        if not arg:
            return DispatchResult(False, "usage: TMMT ops <your command>")
        return run_ops(arg)

    if verb == "brain":
        if not arg:
            return DispatchResult(False, "usage: TMMT brain <problem>")
        return run_brain(arg)

    if verb == "say":
        if not arg:
            return DispatchResult(False, "usage: TMMT say <message>")
        target = reply_handle or os.environ.get("IMESSAGE_BUDDY", "")
        if not target:
            return DispatchResult(False, "no reply handle or IMESSAGE_BUDDY")
        ok = send_imessage(target, arg)
        return DispatchResult(ok, "sent" if ok else "iMessage send failed")

    return DispatchResult(False, f"unknown command: {verb}. Try: TMMT help")


def dispatch_and_reply(text: str, reply_handle: str) -> DispatchResult:
    result = dispatch(text, reply_handle=reply_handle, channel="imessage")
    line = f"TMMT: {result.summary}"[:4000]
    if reply_handle and os.environ.get("IMESSAGE_REPLY_ENABLED", "1") != "0":
        send_imessage(reply_handle, line)
    return result


def main() -> None:
    load_dotenv()
    if len(sys.argv) < 2:
        print("usage: command_router.py '<TMMT ops what's pending>' [--reply-to +1…]")
        sys.exit(1)
    text = sys.argv[1]
    reply_to = None
    if "--reply-to" in sys.argv:
        i = sys.argv.index("--reply-to")
        if i + 1 < len(sys.argv):
            reply_to = normalize_handle(sys.argv[i + 1])
    if reply_to:
        r = dispatch_and_reply(text, reply_to)
    else:
        r = dispatch(text)
    print(r.summary)
    if r.detail and os.environ.get("TMMT_ROUTER_VERBOSE") == "1":
        print(r.detail)
    sys.exit(0 if r.ok else 1)


if __name__ == "__main__":
    main()
