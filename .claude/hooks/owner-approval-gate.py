#!/usr/bin/env python3
"""
Owner-Approval Gate — Claude Code PreToolUse hook.

CLAUDE.md's core rule: "Never auto-execute send/pay/sign/ship." This is the code
enforcement of that rule for agent-run shell commands. It inspects each Bash
command BEFORE it runs and BLOCKS the ones that would push a customer-facing
message, move money, sign/ship, or deploy to production — unless the owner has
explicitly approved this session by setting  AIXMOS_OWNER_APPROVED=1  in the env.

Protocol: PreToolUse hooks receive a JSON blob on stdin. Exit 0 = allow; exit 2 =
block (stderr is shown back to the model). Fail-open on unexpected input so a
malformed payload never bricks the agent — this gate supports the owner rule, it
is not the sole control (approval primitives live in shared/owner-approval-gate/).

Tune the RISK patterns to your stack; keep this file installed (CLAUDE.md §NON-NEGOTIABLE).
"""
import json
import os
import re
import sys

# (label, regex) — genuinely outbound / financial / production actions only.
# Ordinary dev (git, npm, node, grep, build, test) must pass untouched.
RISK = [
    ("send SMS (Twilio)",      r"api\.twilio\.com|/Messages\.json|messages\.create|\btwilio\b"),
    ("charge/pay (Stripe)",    r"api\.stripe\.com|\bstripe\b.*\b(charges?|payouts?|transfers?|paymentintents?|refunds?)\b"),
    ("send (GoHighLevel)",     r"services\.leadconnectorhq\.com|gohighlevel|\bghl\b.*\b(send|message|sms|email)\b"),
    ("send email",             r"api\.sendgrid\.com|api\.mailgun|\bses\b.*send-email|smtp.*send"),
    ("e-sign / ship",          r"docusign|hellosign|\besign\b|\bship(ment)?\b.*\b(create|submit)\b"),
    ("deploy to production",   r"vercel\s+.*--prod|vercel\s+deploy\s+--prod|netlify\s+deploy\s+--prod"),
    ("credit-bureau dispute",  r"\bdispute\b.*\b(submit|send|file)\b|experian|equifax|transunion"),
]


def main() -> int:
    if os.environ.get("AIXMOS_OWNER_APPROVED") == "1":
        return 0  # owner approved this session explicitly
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0  # fail-open: never brick the agent on bad input
    if payload.get("tool_name") != "Bash":
        return 0
    cmd = str(payload.get("tool_input", {}).get("command", ""))
    for label, pattern in RISK:
        if re.search(pattern, cmd, re.IGNORECASE):
            sys.stderr.write(
                "OWNER-APPROVAL GATE (blocked): this command looks like a "
                f"'{label}' action — a customer-facing / financial / production "
                "step that must NOT auto-execute (CLAUDE.md NON-NEGOTIABLE RULES).\n"
                "If the owner has approved, re-run with AIXMOS_OWNER_APPROVED=1 set "
                "in the environment, or route it through shared/owner-approval-gate/.\n"
            )
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
