# TMMT Rentals — Quick Reference (one page)

> Print this. Tape it next to the workstation.

**Live app:** `https://tmmt-command-center.vercel.app`
**Login:** same URL → `/login`
**Owner contact:** _(fill in)_   **Backup contact:** _(fill in)_

---

## Daily 30-second health check

1. Open `https://tmmt-command-center.vercel.app/login` — see "Sign in" form? ✅
2. Sign in → portfolio page loads? ✅
3. Click "TMMT Rentals" → venture dashboard loads with numbers? ✅

If any fails → see OPERATOR_MANUAL.md §10 before doing anything else.

---

## "Where do I go to..." cheat sheet

| I need to... | Go to |
|---|---|
| Add a new customer | `/v/tmmt-rentals/customers` → **New** |
| Add a vehicle | `/v/tmmt-rentals/fleet` → **New** |
| Log a payment | `/v/tmmt-rentals/payments` → **New** |
| Open a ticket | `/v/tmmt-rentals/tickets` → **New** |
| Schedule maintenance | `/v/tmmt-rentals/maintenance` → **New** |
| Add an appointment | `/v/tmmt-rentals/appointments` → **New** |
| Log an inspection | `/v/tmmt-rentals/inspections` → **New** |
| Flag a do-not-rent | `/v/tmmt-rentals/do-not-rent` → **New** |
| See leads | `/v/tmmt-rentals/leads` |
| See contracts | `/v/tmmt-rentals/contracts` |
| Add insurance record | `/v/tmmt-rentals/insurance` → **New** |
| Vendor list | `/v/tmmt-rentals/vendors` |
| Edit any record above | Click the row → modal opens → edit → **Save** |

---

## Public forms (share with customers)

| What | URL to share |
|---|---|
| Lead intake | `tmmt-command-center.vercel.app/forms/lead-intake` |
| Customer intake* | `tmmt-command-center.vercel.app/forms/customer-intake` |
| Waitlist | `tmmt-command-center.vercel.app/forms/waitlist` |
| Appointment | `tmmt-command-center.vercel.app/forms/appointment` |
| Onboarding inspection | `tmmt-command-center.vercel.app/forms/onboarding-inspection` |
| Returning inspection | `tmmt-command-center.vercel.app/forms/inspection` |
| Handover | `tmmt-command-center.vercel.app/forms/handover` |
| License upload | `tmmt-command-center.vercel.app/forms/license-upload` |
| Background check | `tmmt-command-center.vercel.app/forms/background-check` |
| Ticket | `tmmt-command-center.vercel.app/forms/ticket` |

*\* customer-intake is currently 404 in prod (stale deployment) — see OPERATOR_MANUAL §9 KNOWN-1 before sharing it.*

---

## Editing data — which path?

| Change | Use |
|---|---|
| One record, one field | **UI** (click row → edit → Save) |
| Many records at once | **Supabase Studio** (owner only, SQL with WHERE clause) |
| Schema / new feature | **Code change** (owner / dev only — push to master, Vercel auto-deploys) |
| Password reset | **Supabase Auth UI** (not Studio) |

**Hard rules for SQL:**
- ❌ Never `DELETE` or `UPDATE` without `WHERE`.
- ❌ Never edit migrations that have already run.
- ✅ Always run `SELECT COUNT(*) ... WHERE ...` first.
- ✅ Take a backup snapshot before any bulk edit.

---

## "I'm stuck" escalation

1. Read OPERATOR_MANUAL.md §10 (Troubleshooting table).
2. Check status:
   - Vercel: vercel-status.com
   - Supabase: status.supabase.com
3. Ask in #ops channel.
4. Last resort: contact the owner.

---

## Account access

- New operator → owner adds them in Supabase Auth → grants admin role via `npm run set-admin-role -- email@`
- Operator changes password → Supabase auth password-reset email (no in-app page yet)
- Lost access → owner can re-issue a temp password from Supabase Studio
