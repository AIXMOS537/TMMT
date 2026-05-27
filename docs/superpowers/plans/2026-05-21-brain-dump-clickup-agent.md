# Brain-dump → ClickUp Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1 of the Work Command Center agent — an Open WebUI chat that turns brain-dumps into correctly-structured ClickUp tasks assigned to the owner.

**Architecture:** Open WebUI hosts a Claude-API model with two Python tools (`list_ventures`, `clickup_create_task`). Tools read venture config from `~/AIX-Command-Center/config/ventures.json` and the ClickUp API token from `~/AIX-Command-Center/.env`. All runs on the always-on home Windows PC, reachable via Tailscale from the carry and work Macs.

**Tech Stack:** Python 3.10+, `requests`, `pytest`, `pytest-mock`, Open WebUI, Claude API (Anthropic), ClickUp API v2, Tailscale.

**Spec:** [`docs/superpowers/specs/2026-05-21-brain-dump-clickup-agent-design.md`](../specs/2026-05-21-brain-dump-clickup-agent-design.md)

**Where the code lives:** `~/AIX-Command-Center/` (a new small git repo created by Task 2).

---

## File Structure

Before tasks, here are all files this plan creates or modifies. Each file has one responsibility.

| File | Responsibility |
|---|---|
| `~/AIX-Command-Center/.gitignore` | Exclude `.env` and Python build junk from git |
| `~/AIX-Command-Center/.env.example` | Template showing required env vars (committed) |
| `~/AIX-Command-Center/.env` | Owner's real secrets (gitignored, never pushed) |
| `~/AIX-Command-Center/config/ventures.json` | Single source of truth for venture → ClickUp list mapping |
| `~/AIX-Command-Center/tools/requirements.txt` | Python deps for the tool runtime |
| `~/AIX-Command-Center/tools/clickup_client.py` | Pure logic: load_ventures, create_task, create_task_for_venture — easy to test |
| `~/AIX-Command-Center/tools/openwebui_tools.py` | Thin Open WebUI `Tools` class wrapping clickup_client |
| `~/AIX-Command-Center/tools/tests/__init__.py` | Marks tests as a package |
| `~/AIX-Command-Center/tools/tests/test_clickup_client.py` | Unit tests for clickup_client |
| `~/AIX-Command-Center/tools/tests/fixtures/ventures.test.json` | Test fixture for venture config |
| `~/AIX-Command-Center/agents/tmm-business-command-center.agent.md` | Edited persona prompt with brain-dump instructions (file already exists) |
| `~/AIX-Command-Center/OPERATING_GUIDE.md` | Owner's runbook: how to brain-dump, where to look for results |
| `~/AIX-Command-Center/README.md` | Top-level repo readme pointing to spec + operating guide |

`clickup_client.py` (pure logic) and `openwebui_tools.py` (UI shim) are split so tests stay clean and a future v2 (Mattermost, CLI, etc.) reuses `clickup_client.py` without touching Open WebUI.

---

## Task 1: Owner one-time discovery (manual)

**Files:**
- Note: This task produces three values the owner will paste into `.env` and `ventures.json` in Tasks 2 and 3. No files are written yet — just notes.

**Why this is task 1:** Without these three IDs, no other task can produce a working system. Do this first, while the laptop is open.

- [ ] **Step 1: Generate ClickUp API token**

In ClickUp UI: top-left avatar → **Settings** → **Apps** → **API Token** → **Generate**. Copy the token (starts with `pk_`).

Record: `CLICKUP_API_TOKEN=pk_xxxxxxxxx`

- [ ] **Step 2: Find owner's ClickUp user ID**

Run (replace `<TOKEN>` with the token from Step 1):

```bash
curl -s -H "Authorization: <TOKEN>" https://api.clickup.com/api/v2/user
```

Expected output (formatted): JSON with a `user.id` integer field, e.g. `"id": 12345678`.

Record: `CLICKUP_USER_ID=12345678`

- [ ] **Step 3: Find the TMMT Rentals list ID**

Option A (UI): In ClickUp, navigate to the TMMT Rentals list → click the `…` next to its name → **Copy link**. The URL ends in `/li/<list_id>`. Copy that id.

Option B (API): Run

```bash
curl -s -H "Authorization: <TOKEN>" "https://api.clickup.com/api/v2/team"
```

then walk down team → space → folder → list using the IDs returned. (Option A is faster.)

Record: `TMMT_RENTALS_LIST_ID=901234567890`

- [ ] **Step 4: Park the three values somewhere safe**

Paste into your password manager or a sticky note. They'll be used in Tasks 2 and 3.

- [ ] **Step 5: No commit** — nothing was written yet.

---

## Task 2: Initialize `~/AIX-Command-Center/` as a git repo

**Files:**
- Create: `~/AIX-Command-Center/.gitignore`
- Create: `~/AIX-Command-Center/.env.example`
- Create: `~/AIX-Command-Center/.env`
- Create: `~/AIX-Command-Center/README.md`
- Create directories: `~/AIX-Command-Center/config/`, `~/AIX-Command-Center/tools/`, `~/AIX-Command-Center/tools/tests/`, `~/AIX-Command-Center/tools/tests/fixtures/`

- [ ] **Step 1: Initialize git (only if not already a repo)**

```bash
cd ~/AIX-Command-Center
test -d .git || git init
```

Expected: either silence (already a repo) or `Initialized empty Git repository in .../.git/`.

- [ ] **Step 2: Create `.gitignore`**

Write `~/AIX-Command-Center/.gitignore`:

```
# Secrets
.env
.env.local

# Python
__pycache__/
*.pyc
.venv/
.pytest_cache/

# macOS
.DS_Store
._*

# Local notes
*.local.md
```

- [ ] **Step 3: Create `.env.example` (committed, no secrets)**

Write `~/AIX-Command-Center/.env.example`:

```
# Copy this file to .env and fill in real values.
# .env is gitignored — never commit real tokens.

# ClickUp — generate via Settings → Apps → API Token
CLICKUP_API_TOKEN=pk_REPLACE_ME

# Owner's ClickUp user ID — see Task 1 Step 2
CLICKUP_DEFAULT_ASSIGNEE_ID=0

# Anthropic — for the Claude model in Open WebUI (may already be set elsewhere)
ANTHROPIC_API_KEY=sk-ant-REPLACE_ME
```

- [ ] **Step 4: Create the real `.env` (owner-only)**

Write `~/AIX-Command-Center/.env` using the three values from Task 1:

```
CLICKUP_API_TOKEN=<paste pk_ token from Task 1 Step 1>
CLICKUP_DEFAULT_ASSIGNEE_ID=<paste user id from Task 1 Step 2>
ANTHROPIC_API_KEY=<paste existing Anthropic key>
```

- [ ] **Step 5: Create directories**

```bash
mkdir -p ~/AIX-Command-Center/config ~/AIX-Command-Center/tools/tests/fixtures
```

Expected: silent. Verify with `ls ~/AIX-Command-Center/`.

- [ ] **Step 6: Create top-level `README.md`**

Write `~/AIX-Command-Center/README.md`:

```markdown
# AIX Command Center

Owner's work command center: agents, tools, configs.

## Quick links

- **Operating guide:** [`OPERATING_GUIDE.md`](OPERATING_GUIDE.md)
- **v1 spec (brain-dump → ClickUp):** see `~/Documents/TMMT/docs/superpowers/specs/2026-05-21-brain-dump-clickup-agent-design.md`
- **v1 plan:** see `~/Documents/TMMT/docs/superpowers/plans/2026-05-21-brain-dump-clickup-agent.md`

## Layout

```
config/              — venture registry (committed)
tools/               — Python tools registered with Open WebUI
agents/              — persona prompt markdown files
.env                 — secrets (gitignored)
```

## Runtime

Designed to run on the always-on home Windows PC. Open WebUI hosts the chat;
tools in `tools/` are registered in Open WebUI's admin → workspace → tools.
```

- [ ] **Step 7: Confirm `.env` is gitignored before any commit**

```bash
cd ~/AIX-Command-Center && git check-ignore -v .env
```

Expected: a line like `.gitignore:2:.env  .env`. **If no output, STOP — `.gitignore` is wrong, fix Step 2 before continuing.**

- [ ] **Step 8: Initial commit**

```bash
cd ~/AIX-Command-Center
git add .gitignore .env.example README.md
git status
```

Expected `git status`: shows `.gitignore`, `.env.example`, `README.md` as staged; does **NOT** show `.env`.

```bash
git commit -m "chore: initialize command-center repo with gitignore and env template"
```

---

## Task 3: Add `ventures.json` with TMMT Rentals

**Files:**
- Create: `~/AIX-Command-Center/config/ventures.json`

- [ ] **Step 1: Write `config/ventures.json` with the real list ID from Task 1 Step 3**

```json
{
  "ventures": [
    {
      "slug": "tmmt-rentals",
      "name": "TMMT Rentals",
      "clickup_list_id": "<paste TMMT_RENTALS_LIST_ID from Task 1 Step 3>",
      "default_tag": "tmmt-rentals",
      "status": "active"
    }
  ]
}
```

- [ ] **Step 2: Validate the JSON parses**

```bash
python3 -c "import json; print(json.load(open('$HOME/AIX-Command-Center/config/ventures.json')))"
```

Expected: a Python dict printed to stdout with one venture. Errors here mean the JSON has a typo — fix and re-run.

- [ ] **Step 3: Commit**

```bash
cd ~/AIX-Command-Center
git add config/ventures.json
git commit -m "feat(config): register TMMT Rentals venture with ClickUp list id"
```

---

## Task 4: TDD `list_ventures` — failing test, then implement

**Files:**
- Create: `~/AIX-Command-Center/tools/requirements.txt`
- Create: `~/AIX-Command-Center/tools/tests/__init__.py`
- Create: `~/AIX-Command-Center/tools/tests/fixtures/ventures.test.json`
- Create: `~/AIX-Command-Center/tools/tests/test_clickup_client.py`
- Create: `~/AIX-Command-Center/tools/clickup_client.py`

- [ ] **Step 1: Create Python virtualenv and install deps**

```bash
cd ~/AIX-Command-Center/tools
python3 -m venv .venv
source .venv/bin/activate
```

Expected: prompt now shows `(.venv)`.

Write `~/AIX-Command-Center/tools/requirements.txt`:

```
requests==2.32.3
pytest==8.3.3
pytest-mock==3.14.0
```

Install:

```bash
pip install -r requirements.txt
```

Expected: `Successfully installed ...` ending with the three packages.

- [ ] **Step 2: Create empty `tests/__init__.py`**

Write `~/AIX-Command-Center/tools/tests/__init__.py` with no content (empty file marks the dir as a Python package).

- [ ] **Step 3: Create the test fixture**

Write `~/AIX-Command-Center/tools/tests/fixtures/ventures.test.json`:

```json
{
  "ventures": [
    {
      "slug": "tmmt-rentals",
      "name": "TMMT Rentals",
      "clickup_list_id": "111",
      "default_tag": "tmmt-rentals",
      "status": "active"
    },
    {
      "slug": "archived-thing",
      "name": "Old Venture",
      "clickup_list_id": "222",
      "default_tag": "old",
      "status": "archived"
    }
  ]
}
```

- [ ] **Step 4: Write the failing test**

Write `~/AIX-Command-Center/tools/tests/test_clickup_client.py`:

```python
import json
from pathlib import Path

from clickup_client import load_ventures

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "ventures.test.json"


def test_load_ventures_returns_only_active():
    result = load_ventures(FIXTURE_PATH)
    assert len(result) == 1
    assert result[0]["slug"] == "tmmt-rentals"


def test_load_ventures_preserves_required_fields():
    result = load_ventures(FIXTURE_PATH)
    v = result[0]
    assert v["clickup_list_id"] == "111"
    assert v["name"] == "TMMT Rentals"
    assert v["default_tag"] == "tmmt-rentals"
```

- [ ] **Step 5: Run the test, verify it fails**

```bash
cd ~/AIX-Command-Center/tools
PYTHONPATH=. pytest tests/test_clickup_client.py -v
```

Expected: `ImportError` or `ModuleNotFoundError: No module named 'clickup_client'` — confirms we haven't implemented yet.

- [ ] **Step 6: Implement `load_ventures` minimally**

Write `~/AIX-Command-Center/tools/clickup_client.py`:

```python
"""Pure logic for the brain-dump → ClickUp tool. Open WebUI imports from this."""
import json
from pathlib import Path


def load_ventures(ventures_path: Path) -> list[dict]:
    """Read ventures.json and return only ventures with status == 'active'."""
    with open(ventures_path) as f:
        data = json.load(f)
    return [v for v in data["ventures"] if v.get("status") == "active"]
```

- [ ] **Step 7: Run the test, verify it passes**

```bash
cd ~/AIX-Command-Center/tools
PYTHONPATH=. pytest tests/test_clickup_client.py -v
```

Expected: `2 passed`.

- [ ] **Step 8: Commit**

```bash
cd ~/AIX-Command-Center
git add tools/requirements.txt tools/clickup_client.py tools/tests/
git commit -m "feat(tools): add load_ventures with active-only filter and tests"
```

---

## Task 5: TDD `create_task_for_venture` happy path

**Files:**
- Modify: `~/AIX-Command-Center/tools/clickup_client.py` (add function)
- Modify: `~/AIX-Command-Center/tools/tests/test_clickup_client.py` (add tests)

- [ ] **Step 1: Add the failing test**

Append to `~/AIX-Command-Center/tools/tests/test_clickup_client.py`:

```python
from clickup_client import create_task_for_venture


def test_create_task_for_venture_posts_to_correct_list(mocker):
    mock_post = mocker.patch("clickup_client.requests.post")
    mock_post.return_value.status_code = 200
    mock_post.return_value.json.return_value = {
        "id": "abc123",
        "url": "https://app.clickup.com/t/abc123",
    }

    result = create_task_for_venture(
        token="pk_test",
        ventures_path=FIXTURE_PATH,
        venture_slug="tmmt-rentals",
        title="Call Maria",
        description="Customer Maria Rodriguez needs a follow-up call Tuesday",
        assignee_id=12345678,
    )

    assert result["task_id"] == "abc123"
    assert result["url"] == "https://app.clickup.com/t/abc123"
    assert result["title"] == "Call Maria"

    # Verify it hit the right URL
    call_args = mock_post.call_args
    assert call_args.args[0] == "https://api.clickup.com/api/v2/list/111/task"

    # Verify the body
    body = call_args.kwargs["json"]
    assert body["name"] == "Call Maria"
    assert body["description"] == "Customer Maria Rodriguez needs a follow-up call Tuesday"
    assert body["assignees"] == [12345678]
    assert body["tags"] == ["tmmt-rentals"]

    # Verify auth header
    headers = call_args.kwargs["headers"]
    assert headers["Authorization"] == "pk_test"


def test_create_task_for_venture_includes_due_date_when_provided(mocker):
    mock_post = mocker.patch("clickup_client.requests.post")
    mock_post.return_value.status_code = 200
    mock_post.return_value.json.return_value = {"id": "xyz", "url": "https://app.clickup.com/t/xyz"}

    create_task_for_venture(
        token="pk_test",
        ventures_path=FIXTURE_PATH,
        venture_slug="tmmt-rentals",
        title="Oil change",
        description="Mustang VIN 8847",
        assignee_id=12345678,
        due_date_ms=1748390400000,
    )

    body = mock_post.call_args.kwargs["json"]
    assert body["due_date"] == 1748390400000


def test_create_task_for_venture_omits_due_date_when_not_provided(mocker):
    mock_post = mocker.patch("clickup_client.requests.post")
    mock_post.return_value.status_code = 200
    mock_post.return_value.json.return_value = {"id": "xyz", "url": "https://app.clickup.com/t/xyz"}

    create_task_for_venture(
        token="pk_test",
        ventures_path=FIXTURE_PATH,
        venture_slug="tmmt-rentals",
        title="No due date",
        description="task",
        assignee_id=12345678,
    )

    body = mock_post.call_args.kwargs["json"]
    assert "due_date" not in body
```

- [ ] **Step 2: Run, verify failure**

```bash
cd ~/AIX-Command-Center/tools
PYTHONPATH=. pytest tests/test_clickup_client.py -v
```

Expected: 3 new tests fail with `ImportError: cannot import name 'create_task_for_venture'`. The 2 from Task 4 still pass.

- [ ] **Step 3: Implement `create_task_for_venture`**

Append to `~/AIX-Command-Center/tools/clickup_client.py`:

```python
import requests

CLICKUP_API_BASE = "https://api.clickup.com/api/v2"


def create_task_for_venture(
    token: str,
    ventures_path: Path,
    venture_slug: str,
    title: str,
    description: str,
    assignee_id: int,
    due_date_ms: int | None = None,
    priority: int | None = None,
) -> dict:
    """Create a ClickUp task in the list registered for venture_slug.

    Returns: {"task_id": str, "url": str, "title": str}
    Raises:  ValueError if venture not registered
             RuntimeError if ClickUp API call fails
    """
    venture = _lookup_venture(ventures_path, venture_slug)
    list_id = venture["clickup_list_id"]
    tag = venture["default_tag"]

    body = {
        "name": title,
        "description": description,
        "assignees": [assignee_id],
        "tags": [tag],
    }
    if due_date_ms is not None:
        body["due_date"] = due_date_ms
    if priority is not None:
        body["priority"] = priority

    response = requests.post(
        f"{CLICKUP_API_BASE}/list/{list_id}/task",
        headers={"Authorization": token, "Content-Type": "application/json"},
        json=body,
        timeout=15,
    )
    if response.status_code >= 300:
        raise RuntimeError(
            f"ClickUp API returned {response.status_code}: {response.text[:200]}"
        )

    payload = response.json()
    return {
        "task_id": payload["id"],
        "url": payload["url"],
        "title": title,
    }


def _lookup_venture(ventures_path: Path, slug: str) -> dict:
    for v in load_ventures(ventures_path):
        if v["slug"] == slug:
            return v
    raise ValueError(f"Unknown venture slug: {slug!r}")
```

- [ ] **Step 4: Run, verify pass**

```bash
cd ~/AIX-Command-Center/tools
PYTHONPATH=. pytest tests/test_clickup_client.py -v
```

Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
cd ~/AIX-Command-Center
git add tools/clickup_client.py tools/tests/test_clickup_client.py
git commit -m "feat(tools): add create_task_for_venture with TDD coverage for happy path"
```

---

## Task 6: TDD error cases — unknown venture + ClickUp API failure

**Files:**
- Modify: `~/AIX-Command-Center/tools/tests/test_clickup_client.py` (add tests)
- Modify: `~/AIX-Command-Center/tools/clickup_client.py` (already raises — verify and refine if needed)

- [ ] **Step 1: Add the failing tests**

Append to `~/AIX-Command-Center/tools/tests/test_clickup_client.py`:

```python
import pytest


def test_create_task_raises_on_unknown_venture(mocker):
    mock_post = mocker.patch("clickup_client.requests.post")
    with pytest.raises(ValueError, match="Unknown venture slug"):
        create_task_for_venture(
            token="pk_test",
            ventures_path=FIXTURE_PATH,
            venture_slug="does-not-exist",
            title="t",
            description="d",
            assignee_id=1,
        )
    mock_post.assert_not_called()


def test_create_task_raises_on_clickup_api_error(mocker):
    mock_post = mocker.patch("clickup_client.requests.post")
    mock_post.return_value.status_code = 401
    mock_post.return_value.text = "Unauthorized"

    with pytest.raises(RuntimeError, match="ClickUp API returned 401"):
        create_task_for_venture(
            token="pk_bad",
            ventures_path=FIXTURE_PATH,
            venture_slug="tmmt-rentals",
            title="t",
            description="d",
            assignee_id=1,
        )


def test_create_task_raises_on_archived_venture(mocker):
    """Archived ventures are filtered out by load_ventures, so lookup should fail."""
    mock_post = mocker.patch("clickup_client.requests.post")
    with pytest.raises(ValueError, match="Unknown venture slug: 'archived-thing'"):
        create_task_for_venture(
            token="pk_test",
            ventures_path=FIXTURE_PATH,
            venture_slug="archived-thing",
            title="t",
            description="d",
            assignee_id=1,
        )
    mock_post.assert_not_called()
```

- [ ] **Step 2: Run, expect all to pass already**

The current `_lookup_venture` already raises `ValueError`, and `create_task_for_venture` already raises `RuntimeError` on non-2xx. The new tests should pass without code changes — they're documenting and locking in behavior.

```bash
cd ~/AIX-Command-Center/tools
PYTHONPATH=. pytest tests/test_clickup_client.py -v
```

Expected: `8 passed`. If any fail, refine `_lookup_venture` or the error path until they pass — do NOT change the test assertions.

- [ ] **Step 3: Commit**

```bash
cd ~/AIX-Command-Center
git add tools/tests/test_clickup_client.py
git commit -m "test(tools): lock in error behavior for unknown venture and API failures"
```

---

## Task 7: Build the Open WebUI tool shim

**Files:**
- Create: `~/AIX-Command-Center/tools/openwebui_tools.py`

This is the file you paste into Open WebUI's tool editor. It's a thin wrapper — it does no business logic; it just adapts `clickup_client.py` to the Open WebUI `Tools` class shape.

- [ ] **Step 1: Write `openwebui_tools.py`**

Write `~/AIX-Command-Center/tools/openwebui_tools.py`:

```python
"""
title: TMMT Command Center
author: aix
version: 0.1.0
description: Brain-dump → ClickUp task creation across registered ventures.
"""
import os
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field

# When installed in Open WebUI's tools dir, clickup_client must be importable.
# In dev, set PYTHONPATH to the tools/ folder.
from clickup_client import create_task_for_venture, load_ventures

VENTURES_PATH = Path(os.path.expanduser("~/AIX-Command-Center/config/ventures.json"))


class Tools:
    class Valves(BaseModel):
        CLICKUP_API_TOKEN: str = Field(
            default="",
            description="ClickUp personal API token (pk_...). Required.",
        )
        CLICKUP_DEFAULT_ASSIGNEE_ID: int = Field(
            default=0,
            description="Numeric ClickUp user id to assign tasks to. Required.",
        )

    def __init__(self):
        self.valves = self.Valves()

    def list_ventures(self) -> list[dict]:
        """List active ventures the agent can create tasks in.

        :return: list of {slug, name, default_tag} for each active venture
        """
        ventures = load_ventures(VENTURES_PATH)
        return [
            {"slug": v["slug"], "name": v["name"], "default_tag": v["default_tag"]}
            for v in ventures
        ]

    def clickup_create_task(
        self,
        title: str,
        description: str,
        venture_slug: str,
        due_date_ms: Optional[int] = None,
        priority: Optional[int] = None,
    ) -> dict:
        """Create a ClickUp task in the registered list for the given venture.

        :param title: Short imperative task title (e.g. "Call Maria Rodriguez")
        :param description: Original phrasing from the brain-dump, preserved
        :param venture_slug: Must be a slug returned by list_ventures()
        :param due_date_ms: Epoch ms for the due date, or None
        :param priority: 1 (urgent) to 4 (low), or None
        :return: {task_id, url, title} or {error: "..."} on failure
        """
        if not self.valves.CLICKUP_API_TOKEN:
            return {"error": "CLICKUP_API_TOKEN not configured in tool valves"}
        if self.valves.CLICKUP_DEFAULT_ASSIGNEE_ID == 0:
            return {"error": "CLICKUP_DEFAULT_ASSIGNEE_ID not configured in tool valves"}

        try:
            return create_task_for_venture(
                token=self.valves.CLICKUP_API_TOKEN,
                ventures_path=VENTURES_PATH,
                venture_slug=venture_slug,
                title=title,
                description=description,
                assignee_id=self.valves.CLICKUP_DEFAULT_ASSIGNEE_ID,
                due_date_ms=due_date_ms,
                priority=priority,
            )
        except ValueError as e:
            return {"error": str(e)}
        except RuntimeError as e:
            return {"error": str(e)}
```

- [ ] **Step 2: Verify it imports cleanly (no functional test — it's a shim)**

```bash
cd ~/AIX-Command-Center/tools
PYTHONPATH=. python -c "from openwebui_tools import Tools; t = Tools(); print(t.list_ventures())"
```

Expected: prints a list with one dict for `tmmt-rentals`. If `clickup_list_id` is still the placeholder in `ventures.json`, that's fine — `list_ventures` doesn't use it.

- [ ] **Step 3: Commit**

```bash
cd ~/AIX-Command-Center
git add tools/openwebui_tools.py
git commit -m "feat(tools): add Open WebUI Tools shim wrapping clickup_client"
```

---

## Task 8: Edit the persona prompt with brain-dump instructions

**Files:**
- Modify: `~/AIX-Command-Center/agents/tmm-business-command-center.agent.md`

- [ ] **Step 1: Read the current persona prompt to see what's there**

```bash
cat ~/AIX-Command-Center/agents/tmm-business-command-center.agent.md
```

Note the existing structure and tone. Do not throw it away — append brain-dump instructions to it.

- [ ] **Step 2: Append the brain-dump section**

Append to `~/AIX-Command-Center/agents/tmm-business-command-center.agent.md`:

```markdown

---

## Brain-dump → ClickUp behavior (v1)

When the owner sends a message that looks like a brain-dump (multiple items, conversational tone, mentions of things to do or follow up on), do this:

1. **First call `list_ventures()` once** to learn which ventures exist and their slugs.

2. **Parse the brain-dump into discrete tasks.** Each task has:
   - `title`: short imperative, ≤ 60 chars (e.g. "Call Maria Rodriguez — follow-up")
   - `description`: the owner's original phrasing for that item, verbatim
   - `venture_slug`: the slug for the venture the task belongs to. If only one venture is registered, use it. If the brain-dump doesn't make the venture clear, ASK before creating.
   - `due_date_ms`: only set when the owner explicitly mentioned a date. Parse natural-language dates ("Tuesday", "next Friday") to the next occurrence relative to today. Express as Unix epoch milliseconds (UTC noon to avoid timezone edge cases).
   - `priority`: only set if the owner explicitly said "urgent", "important", "low priority", etc. Map: urgent→1, high→2, normal→3, low→4.

3. **Call `clickup_create_task()` once per parsed task.** Do NOT batch — one call per task so each lands as its own ClickUp item.

4. **Reply with a numbered summary** listing each created task with its title and ClickUp URL. Be brief — no preamble, no closing platitudes. Format:

   ```
   Created N tasks on your plate in TMMT Rentals:
   1. <title> — <url>
   2. <title> — <url>
   ...

   All assigned to you for review and routing to your EAs.
   ```

5. **If a tool call returns `{"error": "..."}`**, surface the error verbatim in the reply, do not retry silently, and ask the owner how to proceed.

6. **Do NOT invent due dates, priorities, or assignees that the owner did not state.** If unsure, omit the field.

7. **Do NOT auto-create ventures.** If the brain-dump mentions a venture that isn't in `list_ventures()`, ask: "I don't see a venture called X yet — should I add it later, or did you mean <closest existing slug>?"
```

- [ ] **Step 3: Commit**

```bash
cd ~/AIX-Command-Center
git add agents/tmm-business-command-center.agent.md
git commit -m "feat(agents): teach command-center persona the brain-dump → ClickUp workflow"
```

---

## Task 9: Register the model + tools in Open WebUI (manual checklist)

**Files:** none — Open WebUI configuration via UI.

This is GUI work. Each step is a verified click-path. Test after each.

- [ ] **Step 1: Open Open WebUI from the carry Mac**

Open `http://<home-pc-tailscale-name>:3000` in a browser. Sign in as the owner/admin account.

If the URL doesn't resolve: Tailscale isn't running on home PC, or Open WebUI isn't running. Fix that first (see `~/Documents/local-ai-ops/install.ps1`).

- [ ] **Step 2: Confirm the Anthropic connection is configured**

Admin → **Settings** → **Connections** → **Direct Connections**. Confirm there is an entry for Anthropic with the API key from `.env` (`sk-ant-...`). If not, add it.

Expected: at least one Claude model (e.g. `claude-sonnet-4-6` or `claude-opus-4-7`) shows up in the model dropdown when starting a new chat.

- [ ] **Step 3: Upload `openwebui_tools.py` to Open WebUI's tools workspace**

Admin → **Workspace** → **Tools** → **+** (top right) → paste the entire contents of `~/AIX-Command-Center/tools/openwebui_tools.py`. Save.

- [ ] **Step 4: Configure the tool's valves with the secrets from `.env`**

Open the newly-saved tool → **Valves** (gear icon) → paste:
- `CLICKUP_API_TOKEN`: the `pk_...` token from Task 1 Step 1
- `CLICKUP_DEFAULT_ASSIGNEE_ID`: the integer from Task 1 Step 2

Save.

- [ ] **Step 5: Make `clickup_client.py` importable on the Open WebUI host**

The shim imports `from clickup_client import ...`. On the home PC, copy `clickup_client.py` next to where Open WebUI looks for tool dependencies (depends on install — for Docker installs, mount `~/AIX-Command-Center/tools` into the container; for native installs, put a copy in the same dir as the registered tool file).

For a Docker install (common), edit `docker-compose.yml`:

```yaml
services:
  open-webui:
    volumes:
      - "${HOME}/AIX-Command-Center/tools:/app/backend/tools_extra:ro"
    environment:
      - PYTHONPATH=/app/backend/tools_extra
```

Then `docker compose restart open-webui`.

Expected: tool can be invoked without `ModuleNotFoundError`.

- [ ] **Step 6: Create a model entry called "TMMT Command Center"**

Admin → **Workspace** → **Models** → **+** → choose:
- **Name:** `TMMT Command Center`
- **Base model:** `claude-sonnet-4-6` (or `claude-opus-4-7` if you want max parsing quality)
- **System prompt:** paste the entire contents of `~/AIX-Command-Center/agents/tmm-business-command-center.agent.md`
- **Tools:** check the `TMMT Command Center` tool you uploaded in Step 3

Save.

- [ ] **Step 7: No commit** — this task is UI configuration. The configuration values to record (model name, tool name) are now in Open WebUI's database. They do not live in the git repo. (Optional: take a screenshot of the model config page and save it under `~/AIX-Command-Center/docs/openwebui-setup.png` if you want a recovery aid.)

---

## Task 10: End-to-end smoke test (manual)

**Files:** none — this is a verification task.

- [ ] **Step 1: Open a new chat with the "TMMT Command Center" model**

Open WebUI → New Chat → Model dropdown → **TMMT Command Center**.

- [ ] **Step 2: Paste the canonical 3-item brain-dump**

Paste exactly:

```
Customer Maria Rodriguez needs a follow-up call Tuesday. The white Mustang VIN ending 8847 needs an oil change before Thursday. Also John Smith's contract expires Friday — flag for renewal.
```

- [ ] **Step 3: Verify the agent's reply**

Expected reply format (titles and URLs will differ, but structure must match):

```
Created 3 tasks on your plate in TMMT Rentals:
1. Call Maria Rodriguez — follow-up — https://app.clickup.com/t/xxxxxx
2. Oil change — Mustang VIN ...8847 — https://app.clickup.com/t/yyyyyy
3. Renew contract — John Smith — https://app.clickup.com/t/zzzzzz

All assigned to you for review and routing to your EAs.
```

If the reply does NOT include URLs or includes an `error` line — STOP, check tool valves (Task 9 Step 4) and `ventures.json` list ID (Task 3 Step 1).

- [ ] **Step 4: Open ClickUp and confirm the tasks landed**

In ClickUp UI, open the TMMT Rentals list. Verify three tasks appear at the top:
- Each has the correct title
- Each is assigned to the owner
- Each has the `tmmt-rentals` tag
- Two have due dates (Tuesday, Thursday); the third (contract renewal — mentioned "Friday") should also have a due date

If due dates are missing or wrong, that's an agent prompt issue — refine Task 8 Step 2's instructions until the LLM parses dates correctly. Do not change the tool code.

- [ ] **Step 5: Delete the test tasks (or move them to "Test" status)**

These are demo tasks, not real work. Clean up so the owner's real ClickUp plate isn't cluttered.

- [ ] **Step 6: Record the smoke-test outcome**

Append to `~/AIX-Command-Center/OPERATING_GUIDE.md` (this file gets written in Task 11; for now jot the result in a scratch file or skip — the next task formalizes it).

---

## Task 11: Write the owner's OPERATING_GUIDE.md

**Files:**
- Create: `~/AIX-Command-Center/OPERATING_GUIDE.md`

- [ ] **Step 1: Write the operating guide**

Write `~/AIX-Command-Center/OPERATING_GUIDE.md`:

```markdown
# AIX Command Center — Operating Guide (v1)

This guide tells you, the owner, how to use the brain-dump → ClickUp agent.

## How to brain-dump

1. Open `http://<home-pc-tailscale-name>:3000` from any device on your Tailnet.
2. Sign in.
3. New Chat → select the **TMMT Command Center** model.
4. Type or paste your brain-dump. Be specific about who, what, and when when you can. The more context you give in your message, the better the tasks come out.
5. The agent replies with a numbered list of the tasks it created, each with a clickable ClickUp URL.

### Good brain-dumps

> Customer Maria Rodriguez needs a follow-up call Tuesday. The white Mustang VIN ending 8847 needs an oil change before Thursday. Also John Smith's contract expires Friday — flag for renewal.

> Three urgent things: 1) inspect the Tahoe before it goes out tomorrow, 2) chase the insurance on rental #4421, 3) follow up with the GHL lead from yesterday named Tony.

### Mediocre brain-dumps

> need to deal with stuff today

(Not specific enough — the agent will ask clarifying questions instead of creating tasks.)

## What happens after

Every task the agent creates is assigned to YOU in ClickUp. You review them, then re-assign to your EAs in the normal ClickUp UI. EA-assignment automation is v1.5 (a future plan).

## Adding a new venture

When you launch business #2 (or any future venture):

1. Create a new list in ClickUp for that venture.
2. Copy its list ID (right-click the list → Copy link → the trailing `/li/<id>` segment).
3. Open `~/AIX-Command-Center/config/ventures.json` on the home PC (or any machine with the repo).
4. Add an entry:
   ```json
   {
     "slug": "venture-2-short-name",
     "name": "Venture 2 Pretty Name",
     "clickup_list_id": "<the new list id>",
     "default_tag": "venture-2-short-name",
     "status": "active"
   }
   ```
5. `git commit && git push` (if you've pushed this repo to GitHub).
6. The next time you start a chat with the agent it picks up the new venture automatically — no Open WebUI restart needed.

## Troubleshooting

| Symptom | What to check |
|---|---|
| Agent says "I don't see a venture called X" | The venture isn't in `ventures.json`, or you typed the slug wrong. |
| Agent reply contains `{"error": "CLICKUP_API_TOKEN not configured ..."}` | Tool valves aren't set. Open WebUI → Workspace → Tools → TMMT Command Center → Valves. Paste the `pk_` token. |
| Agent reply contains `{"error": "ClickUp API returned 401"}` | The token is wrong or expired. Re-generate via ClickUp → Settings → Apps → API Token. |
| Agent reply contains `{"error": "ClickUp API returned 429"}` | Rate-limited. Wait 60 seconds and re-paste the brain-dump. |
| URLs work but no tasks appear in ClickUp | You're looking at the wrong list. The list ID in `ventures.json` may not be the TMMT Rentals list — re-check Task 1 Step 3. |
| Open WebUI URL won't load | Tailscale isn't connected, OR Open WebUI isn't running on the home PC. SSH in and run `docker compose ps`. |

## What's coming next (per the v1 spec)

- **v1.5:** EA routing — say "route task #2 to Maria" and the agent reassigns the ClickUp task.
- **v2:** Voice input — speak your brain-dump, Whisper transcribes locally on the home PC.
- **v3:** Conversational status queries — "how's TMMT Rentals this week?" pulls from ClickUp + Supabase.
- **Onwards:** Adding new ventures becomes a routine config-file edit.

See `~/Documents/TMMT/docs/superpowers/specs/2026-05-21-brain-dump-clickup-agent-design.md`.
```

- [ ] **Step 2: Commit**

```bash
cd ~/AIX-Command-Center
git add OPERATING_GUIDE.md
git commit -m "docs: add owner operating guide for the brain-dump agent"
```

- [ ] **Step 3: Final verification — run the full test suite one more time**

```bash
cd ~/AIX-Command-Center/tools
PYTHONPATH=. pytest -v
```

Expected: `8 passed`. If any fail, fix before declaring v1 done.

- [ ] **Step 4: Final smoke test in Open WebUI**

Repeat Task 10 Steps 1-4 with a fresh 5-item brain-dump. All five tasks must land in ClickUp on the owner's plate. This is the success criterion from the spec.

---

## Self-Review (run after writing the plan)

**Spec coverage check:**

| Spec section | Implementing task(s) |
|---|---|
| `clickup_create_task` tool | Tasks 5, 7 |
| `list_ventures` tool | Tasks 4, 7 |
| `ventures.json` config | Task 3 |
| `.env` setup | Task 2 |
| Persona prompt edit | Task 8 |
| Open WebUI registration | Task 9 |
| Owner discovery (token, IDs) | Task 1 |
| Operating guide | Task 11 |
| Acceptance test (3-item brain-dump → 3 ClickUp tasks) | Task 10, Task 11 Step 4 |
| Error handling: unknown venture | Task 6 |
| Error handling: API failure | Task 6 |
| Cost ceiling discussion (Open Q #5) | Not implemented — owner-driven choice, mentioned in OPERATING_GUIDE for future budgeting |
| Subtasks vs N tasks (Open Q #2) | Resolved as "N tasks" — Task 8 Step 2 instructs the persona to call once per task |
| Description preservation (Open Q #3) | Task 8 Step 2 instructs verbatim preservation |

All v1 spec requirements have at least one task. ✓

**Placeholder scan:** Searched for "TBD", "TODO", "fill in", "appropriate", "as needed". None found in step content (only in templated config files where the placeholder is the literal value the owner pastes).

**Type consistency:** Verified — `create_task_for_venture` signature is identical in Tasks 5, 6, 7. Return shape `{task_id, url, title}` is consistent. `_lookup_venture` helper is private and only used internally.

---

## Execution choice

This plan is ready to execute. Two options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Good when you (the owner) want to be able to step away and come back.

2. **Inline Execution** — Execute tasks in this session using executing-plans, with checkpoints for your review. Good when you want to watch each step land.

Which approach?
