#!/usr/bin/env python3
"""
audit-shipper.py — ship local audit.ndjson to Supabase every hour.

Reads ~/Library/Application Support/aixmos-partner/audit.ndjson, posts each
line as a row to partner_audit_events, and on success truncates the local
file. On partial failure, keeps unsent lines for next run.

Format of audit.ndjson lines (written by the apps themselves):
  {"event_ts": "2026-06-09T20:00:00Z", "event_type": "login", "event_data": {...}}
"""
import json
import pathlib
import subprocess
import sys
import time
import urllib.error
import urllib.request

CONFIG = pathlib.Path.home() / ".config" / "tmmt" / "partner.env"
APP_SUPPORT = pathlib.Path.home() / "Library" / "Application Support" / "aixmos-partner"
AUDIT_LOG = APP_SUPPORT / "audit.ndjson"
SHIPPER_LOG = APP_SUPPORT / "audit-shipper.log"
UNSENT = APP_SUPPORT / "audit.unsent.ndjson"


def log(msg: str) -> None:
    APP_SUPPORT.mkdir(parents=True, exist_ok=True)
    with SHIPPER_LOG.open("a") as f:
        f.write(f"{time.strftime('%FT%TZ', time.gmtime())} {msg}\n")


def read_config() -> dict:
    out = {}
    for line in CONFIG.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def hardware_uuid() -> str:
    out = subprocess.check_output(
        ["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"], text=True
    )
    for line in out.splitlines():
        if "IOPlatformUUID" in line:
            return line.split('"')[-2]
    raise RuntimeError("could not read IOPlatformUUID")


def ship_one(cfg: dict, hw: str, event: dict) -> bool:
    payload = {
        "tenant_id": cfg["PARTNER_TENANT_ID"],
        "hardware_uuid": hw,
        "event_ts": event.get("event_ts", time.strftime("%FT%TZ", time.gmtime())),
        "event_type": event["event_type"],
        "event_data": event.get("event_data", {}),
    }
    req = urllib.request.Request(
        f"{cfg['SUPABASE_URL']}/rest/v1/partner_audit_events",
        data=json.dumps(payload).encode(),
        headers={
            "apikey": cfg["SUPABASE_ANON_KEY"],
            "Authorization": f"Bearer {cfg['SUPABASE_ANON_KEY']}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return 200 <= resp.status < 300
    except Exception as e:
        log(f"ship_fail: {e}")
        return False


def main() -> int:
    if not AUDIT_LOG.exists() and not UNSENT.exists():
        log("nothing_to_ship")
        return 0
    cfg = read_config()
    hw = hardware_uuid()

    # Move the current log out of the way so the apps can keep writing
    if AUDIT_LOG.exists():
        tmp = APP_SUPPORT / f"audit.shipping.{int(time.time())}.ndjson"
        AUDIT_LOG.rename(tmp)
    else:
        tmp = None

    # Re-include any unsent lines from prior runs
    failed = []
    sources = [p for p in (UNSENT, tmp) if p and p.exists()]
    for src in sources:
        for line in src.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                log(f"skip_malformed: {line[:120]}")
                continue
            if not ship_one(cfg, hw, event):
                failed.append(line)
        src.unlink()

    if failed:
        UNSENT.write_text("\n".join(failed) + "\n")
        log(f"shipped_with_failures unsent={len(failed)}")
        return 1

    log("ship_ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
