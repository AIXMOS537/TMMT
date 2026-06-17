# REMOTE ACCESS CONSENT — {{CLIENT}}

> ⚠️ Template, not legal advice — have counsel review. Keeps remote takeover clean,
> consented, and logged (never covert).

**Date:** {{DATE}}   **Client:** {{CLIENT}}   **Provider:** TMMT / AIXMOS

The Client authorizes the Provider's team to **remotely access and operate** the
systems listed below to deliver and support the engagement dated {{DATE}}.

**Systems covered** (check / list):
- [ ] The Client's always-on workstation / "antenna" node
- [ ] Dashboards: {{DASHBOARDS}}
- [ ] Other: ______________________________

**How access works (the Client should know):**
- Connection is over an **encrypted private network** (Tailscale) the Client joins.
- Screen control uses **consented remote-desktop** (RustDesk) — the Client can see
  the session and end it at any time.
- **Sessions are logged.** Access is **least-privilege** — only what's needed.
- Provider will **never** access personal/financial accounts outside the agreed
  scope without separate, explicit permission.

**The Client may revoke this consent at any time in writing.** Revoking may pause
delivery/support until restored.

**Acknowledged & consented:**

Client: ________________________  ({{CLIENT}})   Date: __________
