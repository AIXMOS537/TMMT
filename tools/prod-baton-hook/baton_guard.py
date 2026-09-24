"""Claude Code PreToolUse hook: production write baton guard.

The database baton (ops.prod_write_baton) is the authority. This hook is an extra
guardrail: before a recognised PRODUCTION MUTATION it checks that THIS session
holds the baton, and blocks otherwise. It never acquires the baton itself.

Decisions (printed as hook JSON; nothing is printed for allowed calls):
  * not a recognised production write            -> allow, no database call
  * baton held by this session (unexpired)       -> allow
  * free / held by another session / expired     -> deny, with holder and next safe action
  * baton state cannot be determined             -> ask (manual confirmation), never silent allow

This session's holder name is  claude:<session_id>  (session_id comes from the hook input).
Pure-stdlib except pg8000 (loaded lazily, only when a write is recognised).
"""

import json
import os
import re
import subprocess
import sys

SUPABASE = "mcp__af02d979-91ac-41e9-8fd8-d99a5a1ad788__"
VERCEL = "mcp__8a7883fd-ecd2-4e02-8b31-aaeeb7d12eb9__"
PROD_PROJECT = "uapxakmlwnpfsftfeezx"

ALWAYS_WRITE_MCP = {
    SUPABASE + n for n in (
        "apply_migration", "deploy_edge_function", "create_branch", "delete_branch", "merge_branch",
        "reset_branch", "rebase_branch", "pause_project", "restore_project", "create_project", "confirm_cost")
} | {
    VERCEL + n for n in (
        "deploy_to_vercel", "pause_project", "unpause_project", "update_project_deployment_protection",
        "create_git_project", "buy_domain", "buy_pro", "buy_credits", "buy_addon")
}

BATON_FN = re.compile(r"\bops\.(prod_baton_status|acquire_prod_baton|assert_prod_baton|renew_prod_baton|"
                      r"release_prod_baton|recover_stale_prod_baton)\s*\(", re.I)
WRITE_STATEMENT = re.compile(
    r"\b(insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|comment\s+on|copy|call|do|refresh|"
    r"vacuum|reindex|cluster|lock|security\s+label|import\s+foreign|reassign|set\s+role|set\s+session)\b", re.I)
WRITE_FUNCTION = re.compile(
    r"\b(comms\.run_shadow_batch|generate_va_tasks\w*|classify_va_tasks\s*\(\s*false|net\.http_\w+|"
    r"cron\.(schedule|unschedule|alter_job)|setval|nextval|pg_terminate_backend|pg_cancel_backend|lo_\w+|"
    r"agent_wp_\w+|claim_agent_job|finish_agent_job|fail_agent_job|vault\.create_secret|vault\.update_secret)\s*\(", re.I)


def strip_sql(sql):
    """Remove comments, quoted literals and dollar-quoted bodies' *contents markers*.

    Dollar-quoted bodies are kept as a single token so 'do $$ ... $$' still reads as DO.
    """
    s = re.sub(r"--[^\n]*", " ", sql)
    s = re.sub(r"/\*.*?\*/", " ", s, flags=re.S)
    s = re.sub(r"(\$[A-Za-z_0-9]*\$).*?\1", " $body$ ", s, flags=re.S)
    s = re.sub(r"'(?:[^']|'')*'", " 'lit' ", s)
    return s


def sql_is_write(sql):
    s = strip_sql(sql or "")
    remainder = BATON_FN.sub(" noop(", s)
    return bool(WRITE_STATEMENT.search(remainder) or WRITE_FUNCTION.search(remainder))


def sql_is_baton_only(sql):
    s = strip_sql(sql or "")
    return bool(BATON_FN.search(s)) and not sql_is_write(sql)


CMD_WRITE_PATTERNS = [
    (re.compile(r"\bgh\s+pr\s+merge\b"), "merge a pull request (merge = production deploy)"),
    (re.compile(r"\bgh\s+api\b.*(-X|--method)\s*(PUT|POST|PATCH|DELETE)\b.*\bpulls/\d+/merge\b", re.I), "merge a pull request via API"),
    (re.compile(r"\bgit\s+push\b[^|;&]*\b(HEAD:|:)?(refs/heads/)?(master|main)\b"), "push to master/main (production deploy)"),
    (re.compile(r"\bwork-baton\.ps1\b.*-Mode\s+Push\b", re.I), "work-baton push (can fast-forward master)"),
    (re.compile(r"\bvercel\b.*(--prod\b|\bdeploy\b|\bpromote\b|\brollback\b|\balias\b|\benv\s+(add|rm|remove)\b|\bdomains\s+(add|rm)\b)"), "Vercel production/config change"),
    (re.compile(r"\bsupabase\b.*(\bdb\s+push\b|--linked\b|\bfunctions\s+deploy\b|\bsecrets\s+(set|unset)\b|\bmigration\s+(up|repair)\b|\bconfig\s+push\b)"), "Supabase CLI production change"),
    (re.compile(r"\bpsql\b.*" + PROD_PROJECT), "psql against production"),
]
HTTP_WRITE = re.compile(r"(-X|--request|-Method)\s*['\"]?(POST|PUT|PATCH|DELETE)\b|\s(-d|--data\S*|-Body|-F|--form)\s", re.I)
PROD_HOSTS = re.compile(r"(" + PROD_PROJECT + r"\.supabase\.co|api\.supabase\.com|leadconnectorhq\.com|api\.vercel\.com|api\.twilio\.com|hooks\.slack\.com)", re.I)


def git_push_targets_master(command, cwd):
    """`git push` with no explicit master refspec pushes the current branch."""
    if not re.search(r"\bgit\s+push\b", command):
        return False
    try:
        branch = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=cwd or None,
                                capture_output=True, text=True, timeout=5).stdout.strip()
    except Exception:
        return False
    return branch in ("master", "main") and not re.search(r"\bgit\s+push\b[^|;&]*\s[\w./-]+\s+[\w./:-]+", command)


def classify(tool_name, tool_input, cwd=None):
    """Return a short description if this is a recognised production write, else None."""
    ti = tool_input or {}
    if tool_name in ALWAYS_WRITE_MCP:
        return tool_name.split("__")[-1]
    if tool_name == SUPABASE + "execute_sql":
        q = ti.get("query", "")
        if sql_is_baton_only(q):
            return None
        return "production SQL write" if sql_is_write(q) else None
    if tool_name in ("Bash", "PowerShell"):
        cmd = ti.get("command", "") or ""
        for pat, what in CMD_WRITE_PATTERNS:
            if pat.search(cmd):
                return what
        if PROD_HOSTS.search(cmd) and HTTP_WRITE.search(cmd):
            return "write request to a production API"
        if git_push_targets_master(cmd, cwd):
            return "push current branch master/main (production deploy)"
    return None


def decide(what, session_id, status):
    """status: dict from ops.prod_baton_status(), or an Exception if it could not be read."""
    me = "claude:%s" % session_id
    if isinstance(status, Exception) or status is None:
        return "ask", ("BATON STATE UNKNOWN for a production write (%s): %s. The database baton could not be read, "
                       "so this is not silently allowed. Confirm manually only if you know you hold the baton." % (what, status))
    state = status.get("state")
    if state == "held" and status.get("holder_session") == me:
        return "allow", None
    if state == "free":
        detail = "The baton is FREE."
    elif state == "held_expired" and status.get("holder_session") == me:
        detail = "Your baton EXPIRED at %s; renew is not possible after expiry. Recover it only per the stale-lock procedure, then acquire again." % status.get("expires_at")
    else:
        detail = "Held by %s (workstream: %s; acquired %s; expires %s; state %s)." % (
            status.get("holder_session"), status.get("workstream"), status.get("acquired_at"), status.get("expires_at"), state)
    nxt = ("Next safe action: if FREE, acquire explicitly with holder '%s' "
           "(select ops.acquire_prod_baton('%s', '<workstream>', '<purpose>', '<operation>', '<owner approval ref>');), "
           "then retry. If held by someone else: STOP and wait; never steal it." % (me, me))
    return "deny", "BATON REQUIRED for %s. %s %s" % (what, detail, nxt)


def read_status():
    import ctypes
    import ctypes.wintypes as wt
    import ssl
    import pg8000.native as pg

    base = os.path.join(os.environ["LOCALAPPDATA"], "tmmt", "baton-hook")

    class Blob(ctypes.Structure):
        _fields_ = [("cbData", wt.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

    with open(os.path.join(base, "reader.dpapi"), "rb") as f:
        data = f.read()
    ent = b"tmmt-baton-hook-v1"
    b1 = ctypes.create_string_buffer(data, len(data))
    b2 = ctypes.create_string_buffer(ent, len(ent))
    din = Blob(len(data), ctypes.cast(b1, ctypes.POINTER(ctypes.c_char)))
    dent = Blob(len(ent), ctypes.cast(b2, ctypes.POINTER(ctypes.c_char)))
    out = Blob()
    if not ctypes.windll.crypt32.CryptUnprotectData(ctypes.byref(din), None, ctypes.byref(dent), None, None, 0x1, ctypes.byref(out)):
        raise ctypes.WinError()
    try:
        cfg = json.loads(ctypes.string_at(out.pbData, out.cbData))
    finally:
        ctypes.windll.kernel32.LocalFree(out.pbData)

    ctx = ssl.create_default_context(cafile=os.path.join(base, "supabase-root-2021-ca.crt"))
    ctx.verify_flags &= ~getattr(ssl, "VERIFY_X509_STRICT", 0)  # Supabase CA lacks strict-mode extensions
    ctx.check_hostname = True
    conn = pg.Connection(user=cfg["user"], password=cfg["password"], host=cfg["host"], port=int(cfg["port"]),
                         database=cfg["database"], ssl_context=ctx, timeout=6)
    try:
        return conn.run("select ops.prod_baton_status()")[0][0]
    finally:
        conn.close()


def main():
    try:
        event = json.load(sys.stdin)
    except Exception:
        return 0  # not our business; never break unrelated tools
    what = classify(event.get("tool_name"), event.get("tool_input"), event.get("cwd"))
    if not what:
        return 0
    try:
        status = read_status()
    except Exception as e:  # noqa: BLE001 - any failure means UNKNOWN, never allow
        status = RuntimeError("%s: %s" % (type(e).__name__, str(e)[:160]))
    decision, reason = decide(what, event.get("session_id", "unknown"), status)
    if decision == "allow":
        return 0
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                             "permissionDecision": decision,
                                             "permissionDecisionReason": reason}}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
