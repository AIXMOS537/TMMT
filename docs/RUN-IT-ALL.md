# Run It All — the operating manual

One system. Three businesses. Any device. Built so it runs whether you're at the
desk or with your family — and so anyone you trust can carry the torch.

> For: you, Moe, your executive (Justin), VAs, operators — and family who just
> want to know what's going on. Open this on any phone or laptop.

---

## 1. What this is, in one breath

**A business that runs itself from a website.** The hard-won playbook is encoded
in software. A brain (AIXMOS) watches the numbers and tells you the few things
that need a human. Everyone else logs in, does their part, and the system keeps
the books, the leads, the payments, and the people moving — across three
businesses at once.

## 2. The three businesses, and how they fit

| Business | What it is | Where you run it |
|---|---|---|
| **TMMT** | The engine — car rental operations (fleet, customers, payments, dispatch) | Dashboard `/`, `/revenue`, `/fleet`, `/timesheets` |
| **AIXMOS** | The brain + what you sell — AI ops, memberships, builds, kits, credit guidance | `/build`, `/kits`, `/affiliates`, command desk |
| **Moe Legacy** | The partnership venture with Moe — students, communities, giving back | Joins as **venture #3** (see §8 roadmap) |

Same system, same logins, same screens — you just pick the venture you're working
on. The point of all three: **help real people take the leap, do the work, and
build something — and get paid for helping them.**

## 3. Use it on ANY device

- **Phone / tablet / laptop** — open the app URL in any browser, sign in. Done.
  Nothing to install to *use* it.
- **Install it as an app** (recommended): on your phone, open the site → "Add to
  Home Screen." It becomes a real app icon and opens full-screen. On desktop
  Chrome/Edge, click the install icon in the address bar.
- **Offline:** if you lose signal, the app stays installed and shows a friendly
  "you're offline" screen instead of breaking. (Deeper offline — capturing work
  with no signal and uploading it when you're back — is the next phase; see §8.)
- **Every machine (carry M5, M1 brain, Moe Legacy):** one command per machine —
  `bash scripts/one-shot.sh carry` (or `brain` / `moe`). `.env` is pulled from
  Vercel automatically. See `docs/ONE-SHOT-ACROSS-THE-BOARD.md`.

## 4. Who logs in, and what they see

| Person | Role | Sees |
|---|---|---|
| You | **admin** | Everything + the command desk |
| **Justin** | **executive** | Ops, review, your stand-in when you're away |
| **Zayed** | executive (dev) | Ops for testing/building |
| Operators (Ayyan, Dominique, Bibbs, Dyson, …) | **operator** | Only their operator portal |
| VAs / team | staff | The ops they help run |
| Partners | investor | Only their own vehicles (status, plate/VIN) |
| Customers | the offers + `/learn` path | Rent → join → guidance → build |

Nobody gets the code, the keys, or the AI brain. **They get access to use it —
the system stays yours.**

## 5. The daily flow (this is the whole job)

1. Open the app. **"Your Mission Now"** tells you the handful of things that need
   you today — overdue payments, new leads, things that look off.
2. Act on those. Everything else, the team and the system handle.
3. Your team **clocks in at `/clock`**; you see who's working at `/timesheets`
   and **who's worth what at `/scorecard`** (hours vs. value generated — eat what
   you kill).
4. Money lands automatically on **`/revenue`**; helpers get paid on **`/affiliates`**.
5. Close the laptop. Go be with your family. The machine keeps running.

## 6. Flowing your share to your mother and father

The most important line in all of this. Do it at the money layer so it's
automatic and protected:

1. **Standing transfer** — have your bank/accountant set a fixed % of your net
   profit to auto-transfer to your parents each month. It comes off the top,
   before anything else.
2. **Earmark it in the system** — track a recurring "Parents — monthly" line in
   expenses so `/revenue` always reflects it as honored. (I can add a one-click
   "Parents" earmark to the revenue view — just say the word.)

This way it's not a decision you make each month under pressure — it's a promise
the system keeps for you.

## 7. Keeping everyone informed (owners, operators, family)

Some people get hesitant or frightened when things look off. The fix is keeping
them in the loop. The rails exist today (Telegram, Slack, iMessage notifications
for key events). The next step is a clean **"Updates" feed** — current events,
tasks, and anything relevant — that owners, operators, and family can glance at
so nobody's left guessing. See §8.

## 8. What's live vs. what's next (honest roadmap)

**✅ Live now:**
- All three businesses' core ops, on any device, same login
- Installable app + graceful offline screen (this drop)
- Team: clock in/out, timesheets, scorecard; partners, operators, roles all set
- Money: $97 membership recording live; `/build` + `/kits` storefronts ready

**🔜 Next phases (planned, build-when-you-greenlight):**
1. **Deep offline-first** — capture work with no signal, queue it, auto-upload
   when back online. (The ambitious one — done carefully so it never risks live
   data.)
2. **Moe Legacy as venture #3** — wire it in using the multi-venture foundation
   already in the database (`organizations`, `current_organization_id`).
3. **Updates feed** — the stakeholder/family update stream from §7.
4. **Parents earmark** — the one-click distribution tracker from §6.

## 9. Carrying the torch

Anyone you trust can run this from this one manual: open the app on any device,
sign in at their level, follow §5. The system holds the playbook so they don't
have to be you. That's the whole design — so you can build, rest, and take care
of the people who took care of you.
