# Getting Your Credit Knowledge Into the Brain

**2026-09-01** · Owner: *"build the in-house letter generator **after** any and all of my brain across any and all my computers can input and train our main brain that all devices and agents use and pull from… as I used to know how to clean credit and have my files."*

The sequence is right: train the brain on **your** material first, then generate letters from it. Generic templates would produce generic letters.

This document is why that is not working today, and what to do about it.

---

## 1. Three things are blocking it, and none of them is the model

### 🔴 Blocker 1 — embeddings cannot run on this PC

```
OLLAMA_MAX_LOADED_MODELS = 1     (machine-level, BRAINIAC-7)
OLLAMA_NUM_PARALLEL      = 1
```

With a single slot, the embedding model **cannot load while a chat model is loaded**. The embed request does not fail — it **waits forever**. Every ingestion job that reaches the embed step silently hangs.

> This is why "the brain hasn't learned anything" has been the recurring complaint. It is not that learning failed. It is that it never got past the first step, and nothing reported an error.

**Two fixes:**

| | |
|---|---|
| **Raise the limit on BRAINIAC** | `OLLAMA_MAX_LOADED_MODELS=2` at machine level. **Needs admin**, and Ollama must be restarted |
| ✅ **Embed on the M1 instead** | The M1 has `nomic-embed-text` and **no limit set at all**. It is idle enough, has 32 GB, and SSH now works |

`[RECOMMENDED]` **Use the M1 as the embedding engine.** It needs no elevation, no reboot, and it matches the standing topology where the M1 orchestrates and BRAINIAC does heavy compute.

### 🔴 Blocker 2 — the brain feed is drowning

Counts on the M1, right now:

| Location | Files |
|---|---:|
| `BRAIN-FEED/inbox` | **6,687** |
| `BRAIN-FEED/compiled` | **38,307** |
| `BRAIN-FEED/MASTER-CORPUS` | 497 |
| `.quarantine-corpus-20260901-075559` | 497 |
| `.quarantine-corpus-20260901-141006` | 497 |

**Of the 6,687 inbox files, 3,292 are `TAHA-VOICE-*.md`** — and they are all the same report.

Not byte-identical duplicates: each is a **fresh regeneration** of a "TAHA VOICE PROFILE" compiled from your outbound iMessages, rebuilt roughly **every 15 minutes**, so the counts inside differ slightly each time. Functionally it is one document, written 3,292 times.

> ⚠️ **Correction to my own first read.** I initially called these duplicates on the basis that they were all exactly 7,089 bytes. Checked by hash, all 3,292 are unique — so the claim was wrong as stated. The real problem is regeneration, not duplication, and it produces the same outcome: signal buried in volume.

**Two further concerns with that report:**

- It analyses **46,790 outbound messages across 245 contacts**, and lists **phone numbers** in plain text. 3,292 copies of that are sitting in a **synced** folder.
- It is a *writing-style* profile. Useful for sounding like you. **It teaches the brain nothing about credit.**

### 🔴 Blocker 3 — your actual credit material is in quarantine

The credit files are not in the active corpus. They are in `.quarantine-corpus-20260901-141006`:

- `Projects_TMMT_CREDIT_INTELLIGENCE_LIBRARY.md`
- `Projects_TMMT_CREDIT_FUNDING_OS.md`
- `Projects_TMMT_workstream-2-credit-funding_dispute-engine_README.md`
- `..._compliance_README.md` · `..._intake_README.md` · `..._funding-desk_README.md` · `..._tradeline-tracker_README.md` · `..._TASKS.md`
- `Legal-Ops_Contracts_exhibits_RIDER-1-Credit-Repair-Vertical.md`
- `Projects_TMMT_docs_sops_CREDIT-GUIDANCE-SOP.md`

**So the brain is being fed 3,292 copies of your texting style while your credit expertise sits in a quarantine folder.** That is the whole problem in one sentence.

---

## 2. What already exists — do not rebuild it

There is a working learning pipeline at `C:\AI-Brain\_learning\`. It is well designed and it should be used, not replaced.

| Piece | What it does |
|---|---|
| `rawlog/credit.jsonl` | **740 credit entries already captured.** Each carries `domain`, `sender`, `channel`, `scope`, **`consent`**, and a timestamp |
| `Ingest-Message.ps1` / `Ingest-Batch.ps1` | Add material to a domain |
| `Process-Queue.ps1` | Drain the queue |
| `Train-Domain.ps1` | **The teacher.** Reads a domain's memories and synthesises a playbook into the vault. Its prompt says *"Use ONLY the facts in the notes — do not invent specifics"* |
| `Ask-Brain.ps1` | Query it |

Domains already exist: `credit`, `carrental`, `ecom`, `trading`, `general`.

**Consent is a first-class field in the rawlog.** That is unusually good, and it matters for what follows.

### But the credit knowledge in it is thin

The 740 entries are textbook-level:

> *"Dispute inaccurate items with all three bureaus and keep certified-mail receipts as proof of the dispute date."*
> *"Paying revolving balances below 30% utilization, ideally under 10%, lifts a FICO score quickly."*

True, useful, and **not what you know.** The generated `Credit Repair Playbook.md` is 51 lines. `CREDIT_INTELLIGENCE_LIBRARY.md` is 83 lines and mostly empty section headings.

**The expertise you are describing is not in the brain yet.** It is in your head, in files across your machines, and in the workstream tree on the M1.

---

## 3. The plan

### Phase A — clear the channel *(nothing to build)*

| # | Step | Why |
|---|---|---|
| A1 | **Stop the voice-profile regeneration** `com.tmmt.rick-brain-intake` (see below), or point it at a scratch path outside `BRAIN-FEED` | It is 49% of the inbox and adds nothing about credit |
| A2 | **Archive the 3,292 existing copies**, keeping the newest one | Also removes 3,292 copies of 245 phone numbers from a synced folder |
| A3 | **Bring the credit files out of quarantine** into `MASTER-CORPUS` | This is the material that matters |
| A4 | **Point embedding at the M1** | Sidesteps the single-slot trap without elevation |

**The job:** `com.tmmt.rick-brain-intake` on the M1 — runs `~/.config/tmmt/rick-desk/brain-intake.sh` on a **900-second (15-minute) interval**, which matches the TAHA-VOICE timestamps exactly. Every run writes a **new timestamped file** rather than overwriting one, so the count only ever grows.

The smallest correct fix is one of:

- write to a **fixed filename** (`TAHA-VOICE-PROFILE.md`) so each run replaces the last, or
- write **outside** `BRAIN-FEED`, since a writing-style profile is not corpus material.

⚠️ I have **not** changed it. It is a live daemon on your Mac and altering a running job is a behaviour change, not a cleanup. Also worth a look while there: `com.tmmt.voice-work` fires every **45 seconds**, which is very tight for a scheduled job.

### Phase B — harvest what you already wrote

Sources found so far, on both machines:

| Source | Where |
|---|---|
| `CREDIT_INTELLIGENCE_LIBRARY.md` | repo — structure exists, content thin |
| `CREDIT_FUNDING_OS.md` | repo |
| `credit-compliance.json` | repo — machine-readable rules |
| `CREDIT-GUIDANCE-SOP.md`, `CREDIT-FUNDING-COMPLIANCE.md` | repo |
| `Credit Repair Playbook.md` | `C:\AI-Brain\Trainings\Credit Repair\` |
| `credit.jsonl` (740 entries) | `C:\AI-Brain\_learning\rawlog\` |
| `CREDIT-SURVIVAL-PLAYBOOK-2026-07-07.md` | `C:\Sync\BRAIN\vault-mirror\` |
| `dispute-process-lawful.md`, `credit-guidance-workflow.md` | `C:\Sync\MOE-LEGACY-READY\` |
| `ZERO-RIBA-CREDIT-PATH.md` | `C:\Sync\PROJECT-X-UMMAH-OVERDRIVE\` |
| **`workstream-2-credit-funding/`** — dispute-engine, compliance, intake, funding-desk, tradeline-tracker | **M1 only:** `~/Projects/TMMT/` |
| **`RIDER-1-Credit-Repair-Vertical.md`** | **M1 only:** `~/…/Legal-Ops/Contracts/exhibits/` |

⚠️ **The M1 holds credit material that does not exist on this PC at all.** Any harvest that only looks at BRAINIAC misses it.

### Phase C — capture what is only in your head

This is the part no script can do, and it is the part that actually matters.

The 740 existing entries are general knowledge. **What makes an in-house letter generator worth building is the judgement**: which dispute round to use when, what actually gets a deletion versus a verification, how a furnisher responds differently from a bureau, which items to leave alone.

`[RECOMMENDED]` the cheapest capture method, given the pipeline that exists:

1. Talk or type into the existing ingest — one decision rule per entry, tagged `domain: credit`.
2. Use the section structure already in `CREDIT_INTELLIGENCE_LIBRARY.md`: Patterns · Objections · Success Indicators · Readiness Indicators · FAQ.
3. Run `Train-Domain.ps1 -Domain credit` to synthesise it into a playbook.
4. Review the playbook and correct it. **The correction is the training** — that is exactly the local-first pattern already in your rules.

### Phase D — then the letter generator

Only after C. The existing `letters/generator.ts` already produces six letter types (§611, MOV, factual confrontation, §623, FDCPA validation, CFPB escalation). Rebuilding it from your knowledge means replacing its *content and sequencing logic* with yours, not rewriting its plumbing.

---

## 4. 🔴 In-house means CROA applies to you

Stated once, plainly, because you have chosen this direction and it changes your obligations.

Generating dispute letters for consumers, for a fee, makes TMMT/AIXMOS a **Credit Repair Organization**. That is a legal status, not a marketing description. It brings:

| Requirement | Current state |
|---|---|
| Written contract with statutory CROA disclosures | ⬜ |
| Separate *Consumer Credit File Rights* disclosure, signed **before** the contract | ⬜ |
| **Three-day right to cancel**, in writing | `cancel_by` column exists in `dispute_engine` |
| **No fee collected before services are fully performed** | ⚠️ Catalogue holds $97/mo, $250+$250, $1,000 DFY |
| No untrue or misleading representations | Old script archived today |
| State registration and bonding | ⬜ Virginia — needs checking |
| `credit_education_acknowledgments` written on every enrolment | **0 rows** |

**Build these rails in Phase D alongside the generator, not after it.** A letter engine that can run before the disclosure flow exists is the risk; the two shipping together is not.

Also relevant, found today by another session: the dispute desk had been keeping client records — **legal name, email, phone, date of birth, SSN last four, address and tri-bureau scores** — in **browser localStorage**. That has now been rescued into `dispute_clients` in Supabase. Worth knowing that the most sensitive data in the business was one cleared cache from gone.

---

## 5. Next actions

| # | Action | Needs |
|---|---|---|
| 1 | Stop the voice-profile regeneration | Me — once I find what launches it |
| 2 | Archive 3,292 copies, keep the newest | Your OK — it is a deletion |
| 3 | Un-quarantine the credit files into `MASTER-CORPUS` | Me |
| 4 | Route embedding to the M1 | Me |
| 5 | Harvest the M1 workstream + all sources in §B into `credit.jsonl` | Me |
| 6 | **Capture your actual expertise** | **You** — nothing else substitutes |
| 7 | Build the letter generator + CROA rails together | Me, after 6 |

**Step 6 is the whole project.** Steps 1–5 clear the way so that when you start talking, it lands somewhere that works.

---

# RESULTS — steps 1–5 executed, 2026-09-01

## The diagnosis changed once I read the daemon

`brain-intake.sh` is a **good** script — it extracts, chunks, embeds with `nomic-embed-text` and stores to `vectors.jsonl`. It was never broken.

**It watches `~/Sync/RICK-DESK/BRAIN-FEED/`. Everything was piling up in `~/Sync/rick/BRAIN-FEED/`.** Two different directories, one character apart in the eye, nothing in common to the shell.

| | |
|---|---:|
| `RICK-DESK/BRAIN-FEED` — what the ingester watches | **2 entries** |
| `rick/BRAIN-FEED` — where 45,000 files accumulated | inbox 6,687 · compiled 38,307 |
| **`vectors.jsonl` — everything the brain had ever learned** | **6 chunks** |

This is the same failure recorded in August as the runaway enqueue loop: *"the guard watched a different inbox than Enqueue wrote to."* It happened again, in a different pair of folders.

> So the embedding limit on BRAINIAC is real but was **not** the active blocker. The M1 has no limit and its ingester worked fine — it was simply starving.

## What was done

| # | Step | Result |
|---|---|---|
| 1 | Stop the voice-profile regeneration | ⚠️ **Not done — cannot reach it.** See below |
| 2 | Archive the regenerated copies | ✅ **3,293 archived**, newest kept. Inbox 6,697 → 3,404 |
| 3 | Un-quarantine the credit files | ✅ Recovered and staged |
| 4 | Get embedding working | ✅ **Verified working on the M1** |
| 5 | Harvest every credit source | ✅ **34 sources ingested from both machines** |

### The corpus now

| | Before | After |
|---|---:|---:|
| Vectors (embedded chunks) | **6** | **242** |
| `KNOWLEDGE.md` | 96 lines | **2,193 lines** |
| Sources | 6 | **34** (28 credit-specific) |

Largest contributors: `RIDER-1-Credit-Repair-Vertical` (35 chunks), `CREDIT_FUNDING_OS` (14), the credit-guidance pitch (13), the MOE phone script (10).

### Two file types were being silently dropped

`extract_text()` handles `txt|md|csv|json|log` — but **not `.jsonl` and not `.ts`**. Six files, including the single largest knowledge source, were stored as *"[unsupported type]"* with no content extracted.

Fixed by converting rather than forcing: the rawlog was rendered to clean markdown (one note per bullet, JSON scaffolding stripped so it does not pollute the embeddings) and the engine sources renamed to `.md`.

**The rawlog turned out to be 341 unique notes, not 740** — 399 were duplicates. Channel breakdown: telegram-export 326, vault 8, manual 3, slack 2, media-content 2.

`[RECOMMENDED]` add `jsonl` and `ts|js|py|sql` to the extractor's case statement, so this stops happening.

## ⚠️ Step 1 could not be done from here

The TAHA-VOICE profile is not written by anything on the M1. Its own header says **"compiled by Carry Watchtower"**, and there is a separate `watchtower` node on the tailnet (`100.77.126.8`, macOS) that **refuses my SSH key**.

So the regeneration continues — it produced two more files while this work was running. The archive removes the backlog but not the source.

**To stop it, someone needs access to the `watchtower` Mac.** The fix there is one line: write to a fixed filename instead of a new timestamped one.

## It answers questions now

Query: *"how do I dispute a collection account with the credit bureau"* — top hit, score 0.725, from `dispute-process-lawful.md`:

> **"Hard rule: If an item is accurate, current, and verifiable, it is not disputed. It is coached on (behavior + time). Document for each item: bureau(s), creditor, the specific factual reason…"**

That is a real judgement rule, in the owner's own material, and it is exactly the kind of thing the in-house generator must respect — **the letter engine has to be able to decline to write a letter.**

Query: *"what makes a client ready for funding"* returned the guidance pitch, the funding-desk spec and `CREDIT_FUNDING_OS` intake questions.

## Query tool

`scripts/askbrain.py`, installed on the M1 at `~/.config/tmmt/rick-desk/askbrain.py`:

```bash
ssh m1 'python3 ~/.config/tmmt/rick-desk/askbrain.py "your question"'
ssh m1 'python3 ~/.config/tmmt/rick-desk/askbrain.py --stats'
```

## What is still step 6, and still only yours

242 chunks of **documents** are now searchable. That is the floor, not the ceiling.

What is in there is what was already written down — SOPs, pitches, compliance rules, the legal rider, and the code's own logic. **What is not in there is the judgement**: which round to run when, what actually earns a deletion versus a verification, when to leave an item alone.

The channel is clear now. When you start talking, it will land somewhere that works.
