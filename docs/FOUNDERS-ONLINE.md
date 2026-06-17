# Founders Online — get Ayyan Khan + MoeLegacy live NOW

> Fast runbook for the two founding seats. Deferred brain cost (settle the $50K
> over time). Goal: nodes on the mesh, first local brain running, dashboards up,
> Owner able to remote in — **today**. Owner = Muhammad Taha (Head Master).
> Companions: `docs/OFFER-STACK.md`, `docs/PROJECT-X-HAILMARY.md`, `docs/DEPLOY-EVERYWHERE.md`.

---

## Do this once on the Owner side (Muhammad Taha)

1. **Issue their seats** (license + consent record):
   ```bash
   bash scripts/partner-deploy/owner/issue-license.sh   # one for Ayyan, one for MoeLegacy/Umar
   ```
2. Have **Tailscale admin** open to **approve their devices** as they join
   (least-privilege per `scripts/partner-deploy/tailscale-acl.json`).
3. Keep **BRAINIAC 7 / Fatherbox** on so you can watch + remote in:
   `bash scripts/fatherbox`

---

## Track A — Ayyan Khan (TMMT / network operator)

On Ayyan's laptop, in order (paste each line):

1. **Get on the mesh:** install Tailscale → sign in → tell Owner to approve.
2. **Get the code + deploy as operator:**
   ```bash
   git clone https://github.com/AIXMOS537/TMMT.git ~/TMMT && cd ~/TMMT && bash scripts/motherbox operator
   ```
3. **Stand up his first local brain (by his laptop's RAM):**
   ```bash
   bash scripts/setup-llm.sh
   ```
4. **Remote support tool:** install RustDesk → share ID with Owner (consented).
5. He's live: `menu` shows his fenced operator words (`work · sync · who · compass · sos`).

---

## Track B — MoeLegacy / Muhammad Umar (credit + funding vertical)

Same base, plus the credit/funding CRM:

1. Tailscale → sign in → Owner approves.
2. Deploy + brain:
   ```bash
   git clone https://github.com/AIXMOS537/TMMT.git ~/TMMT && cd ~/TMMT && bash scripts/motherbox operator && bash scripts/setup-llm.sh
   ```
3. **CRM stack (the $25K vertical), Owner-driven from the backend:**
   - **GoHighLevel** sub-account for MoeLegacy: pipelines for **credit guidance +
     funding** (vocabulary: *"guidance," never "repair"*).
   - **Airtable** base for client data-entry + workflow automations.
   - AIXMOS agents wired to the pipeline (intake → review → follow-up).
4. RustDesk for Owner remote-in to build/manage the backend.
5. Live: Umar/team work the dashboards; Owner runs the backend from the Watchtower.

---

## "Are they online?" — the Owner's check

From BRAINIAC 7:
```bash
bash scripts/fatherbox        # whole network + levers
bash scripts/tmmt who         # who's online right now
bash scripts/tmmt mesh        # every device
```
Each founder's laptop = an **antenna**: as long as it's plugged in, on the mesh,
and online, the Owner can reach in anytime and run the show.

---

## What's covered now vs. what's still the Owner's hand

- ✅ Built/automated here: deploy, local brain, mesh roles, watch, remote-support path.
- 🤝 Owner does: approve devices in Tailscale, create the GoHighLevel sub-account +
  Airtable base (accounts only you can log into), run the consented RustDesk session.
- 💵 Money: founders deferred; record hours/commission against the $50K in your books.

> Honest note from HAILMARY: the GoHighLevel + Airtable accounts and the Tailscale
> approvals need your login — I can't create third-party accounts for you, but I've
> made every step that *can* be one command, one command. Tell me when their
> accounts exist and I'll wire the pipelines + AIXMOS agents.
