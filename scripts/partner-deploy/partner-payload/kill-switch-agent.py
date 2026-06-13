#!/usr/bin/env python3
"""
kill-switch-agent.py — local enforcement of the four-tier kill switch.

Runs as a launchd agent every 15 minutes on the partner's Mac. Polls the
narrow Supabase RPC `partner_license_status` (returns only active +
kill_command — never enumerates other tenants).

Actions:
  - active=true,  kill_command=NULL          → clear any disabled marker (apps run)
  - active=false, kill_command=NULL          → write disabled marker (apps refuse)
  - active=*,     kill_command='soft_disable'→ same as disabled
  - active=*,     kill_command='legal_hold'  → write legal-hold marker (apps refuse, no wipe)
  - active=*,     kill_command='wipe'        → WIPE local install + revoke Tailscale + exit

The wipe action is irreversible. The agent self-disables after wiping (so the
launchd plist doesn't keep re-running). New install requires a new flash drive.
"""
import json
import os
import pathlib
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

APP_SUPPORT = pathlib.Path.home() / "Library" / "Application Support" / "aixmos-partner"
CONFIG_DIR = pathlib.Path.home() / ".config" / "tmmt"
PARTNER_CONFIG = CONFIG_DIR / "partner.env"
DISABLED_MARKER = APP_SUPPORT / ".disabled"
LEGAL_HOLD_MARKER = APP_SUPPORT / ".legal-hold"
WIPED_MARKER = APP_SUPPORT / ".wiped"
LAUNCH_AGENTS = pathlib.Path.home() / "Library" / "LaunchAgents"

LOG = APP_SUPPORT / "kill-switch.log"


def log(msg: str) -> None:
    APP_SUPPORT.mkdir(parents=True, exist_ok=True)
    with LOG.open("a") as f:
        f.write(f"{time.strftime('%FT%TZ', time.gmtime())} {msg}\n")


def read_config() -> dict:
    out = {}
    for line in PARTNER_CONFIG.read_text().splitlines():
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


def license_status(cfg: dict, hw: str) -> dict:
    """Call the SECURITY DEFINER RPC. Returns dict with active, kill_command, killed_at."""
    body = json.dumps(
        {"p_tenant_id": cfg["PARTNER_TENANT_ID"], "p_hardware_uuid": hw}
    ).encode()
    req = urllib.request.Request(
        f"{cfg['SUPABASE_URL']}/rest/v1/rpc/partner_license_status",
        data=body,
        headers={
            "apikey": cfg["SUPABASE_ANON_KEY"],
            "Authorization": f"Bearer {cfg['SUPABASE_ANON_KEY']}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
    except urllib.error.URLError as e:
        log(f"network_error: {e}")
        # Network failure: fail SAFE (no action) and let heartbeat-miss tier take over
        # after 72h. Do NOT silently treat unreachable as "active".
        return {"network_error": True}
    if not data:
        log("no_license_row_for_this_hardware — treating as soft-disabled")
        return {"active": False, "kill_command": None}
    return data[0]


def clear_markers() -> None:
    for m in (DISABLED_MARKER, LEGAL_HOLD_MARKER):
        if m.exists():
            m.unlink()
            log(f"cleared marker: {m.name}")


def write_marker(path: pathlib.Path, reason: str) -> None:
    APP_SUPPORT.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{time.strftime('%FT%TZ', time.gmtime())} {reason}\n")
    os.chmod(path, 0o400)
    log(f"wrote marker: {path.name} ({reason})")


def execute_wipe() -> None:
    """
    HARD WIPE. Irreversible.
    - Removes ~/Library/Application Support/aixmos-partner/
    - Removes ~/.config/tmmt/
    - Best-effort tailscale logout
    - Best-effort remove our launchd plists so we don't re-run
    """
    log("WIPE: starting")

    # Tailscale logout (best-effort; don't fail wipe if missing)
    for tsbin in ("/Applications/Tailscale.app/Contents/MacOS/Tailscale", "/usr/local/bin/tailscale"):
        if pathlib.Path(tsbin).exists():
            try:
                subprocess.run([tsbin, "logout"], check=False, timeout=30)
                log(f"tailscale logout via {tsbin}")
            except Exception as e:
                log(f"tailscale logout error: {e}")
            break

    # Remove launchd plists (so kill-switch doesn't restart)
    for plist in (
        "tools.aixmos.partner.killswitch.plist",
        "tools.aixmos.partner.heartbeat.plist",
        "tools.aixmos.partner.audit.plist",
    ):
        p = LAUNCH_AGENTS / plist
        if p.exists():
            subprocess.run(
                ["launchctl", "unload", str(p)], check=False, capture_output=True
            )
            p.unlink()
            log(f"removed plist: {plist}")

    # Mark wipe BEFORE deleting APP_SUPPORT (so we can prove we ran)
    wiped_evidence = pathlib.Path.home() / ".aixmos-partner-wiped"
    wiped_evidence.write_text(
        f"wiped_at={time.strftime('%FT%TZ', time.gmtime())}\nhostname={socket.gethostname()}\n"
    )

    # Remove keychain key (best-effort)
    subprocess.run(
        ["security", "delete-generic-password", "-s", "tools.aixmos.partner.device"],
        check=False,
        capture_output=True,
    )

    # Remove config + app support
    for d in (CONFIG_DIR, APP_SUPPORT):
        if d.exists():
            shutil.rmtree(d, ignore_errors=True)
            # Note: APP_SUPPORT is logging dir — log() will fail after this. OK.

    # Final outbound audit event
    try:
        cfg = read_config()  # may fail because we just removed config — try anyway
    except Exception:
        cfg = None
    return  # process exits naturally


def main() -> int:
    APP_SUPPORT.mkdir(parents=True, exist_ok=True)
    log("poll_start")
    cfg = read_config()
    hw = hardware_uuid()
    status = license_status(cfg, hw)

    if status.get("network_error"):
        log("network_unreachable — no action this poll")
        return 0

    active = bool(status.get("active"))
    cmd = status.get("kill_command")
    log(f"status active={active} kill_command={cmd!r}")

    if cmd == "wipe":
        execute_wipe()
        return 0

    if cmd == "legal_hold":
        write_marker(LEGAL_HOLD_MARKER, "legal_hold per server")
        return 0

    if cmd == "soft_disable" or not active:
        write_marker(DISABLED_MARKER, "soft disable per server")
        return 0

    # All good: clear any prior markers
    clear_markers()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        log(f"FATAL: {e}")
        sys.exit(1)
