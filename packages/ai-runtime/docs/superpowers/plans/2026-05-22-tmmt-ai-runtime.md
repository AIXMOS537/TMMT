# TMMT-AI-RUNTIME Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform Node.js CLI (`tmmt`) that fronts the AIXMOS agents with per-device Ollama backend wiring across the owner's three machines.

**Architecture:** A zero-dependency Node CLI in its own git repo. `setup.js` detects the machine and writes a per-device `DEVICE_ROLE.md`. `tmmt.js` reads that config, reads an agent manifest (`tmmt.agents.json`) from the `AIXMOS-AGENTS` repo, filters out Docker-only agents where Docker is absent, and launches agents via `npm run <script>`. Pure logic lives in `lib/` modules tested with `node:test`; the CLI files are thin glue.

**Tech Stack:** Node.js v26 (CommonJS), Node standard library only (`node:test`, `node:assert`, `child_process`, `readline`, `fs`, `os`, `path`). No third-party dependencies.

**Spec:** `docs/superpowers/specs/2026-05-22-tmmt-ai-runtime-design.md`

**Repo root:** `/Users/ceo.moe/TMMT-AI-RUNTIME` (all paths below are relative to it unless absolute).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `package.json` | Package metadata, `test` script, `bin` mapping. No dependencies. |
| `.gitignore` | Ignore `DEVICE_ROLE.md`, `node_modules`, OS junk. |
| `lib/device.js` | Detect role from hostname; parse/format/read/write `DEVICE_ROLE.md`. |
| `lib/agents.js` | Load the agent manifest; filter by Docker availability; find by id. |
| `lib/run.js` | Build the `npm run` command + env; spawn the agent process. |
| `lib/menu.js` | Render the numbered menu; parse a menu selection. |
| `tmmt.js` | CLI entry point — wires the `lib/` modules; menu loop + subcommands. |
| `setup.js` | Per-device setup — detect environment, prompt, write `DEVICE_ROLE.md`. |
| `tmmt.command` / `tmmt.bat` | Double-click wrappers for the launcher. |
| `setup.command` / `setup.bat` | Double-click wrappers for setup. |
| `test/*.test.js` | `node:test` suites, one per module plus CLI/setup integration. |
| `test/fixtures/aixmos/tmmt.agents.json` | Stand-in `AIXMOS-AGENTS` manifest for tests. |
| `README.md` | Install + usage instructions. |
| `~/AIXMOS-AGENTS/tmmt.agents.json` | **New file in the sibling repo** — the real agent manifest. |

---

## Task 1: Scaffold the repo

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "tmmt-ai-runtime",
  "version": "1.0.0",
  "private": true,
  "description": "Unified launcher for the AIXMOS agents across the TMMT machine fleet",
  "bin": { "tmmt": "tmmt.js" },
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```gitignore
DEVICE_ROLE.md
node_modules/
.DS_Store
._*
*.log
```

- [ ] **Step 3: Commit**

```bash
cd /Users/ceo.moe/TMMT-AI-RUNTIME
git add package.json .gitignore
git commit -m "chore: scaffold TMMT-AI-RUNTIME package"
```

---

## Task 2: `lib/device.js` — device detection and config file

**Files:**
- Create: `lib/device.js`
- Test: `test/device.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/device.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { detectRole, parseDeviceRole, formatDeviceRole } = require('../lib/device');

test('detectRole maps known host nicknames, null otherwise', () => {
  assert.strictEqual(detectRole('Brainiac-7'), 'home');
  assert.strictEqual(detectRole('coding-brain.local'), 'work');
  assert.strictEqual(detectRole('Mobile-Control-Station'), 'carry');
  assert.strictEqual(detectRole('some-random-host'), null);
  assert.strictEqual(detectRole(''), null);
});

test('parseDeviceRole reads frontmatter fields and coerces dockerAvailable', () => {
  const text = [
    '---',
    'role: home',
    'os: win32',
    'hostname: BRAINIAC-7',
    'aixmosPath: D:\\AIXMOS-AGENTS',
    'ollamaHost: http://localhost:11434',
    'ollamaModel: llama3.2:3b',
    'dockerAvailable: true',
    'generatedAt: 2026-05-22T00:00:00Z',
    '---',
    '# This machine: HOME',
  ].join('\n');
  const cfg = parseDeviceRole(text);
  assert.strictEqual(cfg.role, 'home');
  assert.strictEqual(cfg.aixmosPath, 'D:\\AIXMOS-AGENTS');
  assert.strictEqual(cfg.ollamaHost, 'http://localhost:11434');
  assert.strictEqual(cfg.dockerAvailable, true);
});

test('parseDeviceRole throws when there is no frontmatter', () => {
  assert.throws(() => parseDeviceRole('no frontmatter here'), /frontmatter/);
});

test('formatDeviceRole round-trips through parseDeviceRole', () => {
  const config = {
    role: 'carry', os: 'darwin', hostname: 'mac',
    aixmosPath: '/Users/x/AIXMOS-AGENTS',
    ollamaHost: 'http://localhost:11434', ollamaModel: 'llama3.2:3b',
    dockerAvailable: false, generatedAt: '2026-05-22T00:00:00Z',
  };
  const parsed = parseDeviceRole(formatDeviceRole(config));
  assert.strictEqual(parsed.role, 'carry');
  assert.strictEqual(parsed.dockerAvailable, false);
  assert.strictEqual(parsed.aixmosPath, '/Users/x/AIXMOS-AGENTS');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/device.test.js`
Expected: FAIL — `Cannot find module '../lib/device'`.

- [ ] **Step 3: Write `lib/device.js`**

```js
const fs = require('fs');
const path = require('path');

const ROLE_HINTS = [
  { role: 'home', pattern: /brainiac/i },
  { role: 'work', pattern: /coding/i },
  { role: 'carry', pattern: /mobile|control/i },
];

const FIELDS = [
  'role', 'os', 'hostname', 'aixmosPath',
  'ollamaHost', 'ollamaModel', 'dockerAvailable', 'generatedAt',
];

function detectRole(hostname) {
  for (const { role, pattern } of ROLE_HINTS) {
    if (pattern.test(hostname || '')) return role;
  }
  return null;
}

function parseDeviceRole(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error('DEVICE_ROLE.md has no frontmatter block');
  }
  const config = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    config[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  config.dockerAvailable = config.dockerAvailable === 'true';
  return config;
}

function formatDeviceRole(config) {
  const lines = ['---'];
  for (const key of FIELDS) {
    const value = key === 'dockerAvailable'
      ? String(Boolean(config[key]))
      : (config[key] == null ? '' : config[key]);
    lines.push(`${key}: ${value}`);
  }
  lines.push('---');
  lines.push(`# This machine: ${String(config.role || 'unknown').toUpperCase()}`);
  lines.push('');
  lines.push('Edit the frontmatter above to change how the launcher behaves on');
  lines.push('this machine. This file is git-ignored — per-device, never committed.');
  lines.push('');
  return lines.join('\n');
}

function deviceRolePath(runtimeDir) {
  return path.join(runtimeDir, 'DEVICE_ROLE.md');
}

function readDeviceRole(runtimeDir) {
  const file = deviceRolePath(runtimeDir);
  if (!fs.existsSync(file)) return null;
  return parseDeviceRole(fs.readFileSync(file, 'utf8'));
}

function writeDeviceRole(runtimeDir, config) {
  fs.writeFileSync(deviceRolePath(runtimeDir), formatDeviceRole(config));
}

module.exports = {
  detectRole, parseDeviceRole, formatDeviceRole,
  deviceRolePath, readDeviceRole, writeDeviceRole,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/device.test.js`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/device.js test/device.test.js
git commit -m "feat: add device detection and DEVICE_ROLE.md parsing"
```

---

## Task 3: `lib/agents.js` — agent manifest loading and filtering

**Files:**
- Create: `lib/agents.js`
- Create: `test/fixtures/aixmos/tmmt.agents.json`
- Test: `test/agents.test.js`

- [ ] **Step 1: Create the test fixture manifest**

Create `test/fixtures/aixmos/tmmt.agents.json`:

```json
{
  "agents": [
    { "id": "jarvis", "label": "JARVIS — ops assistant", "script": "jarvis", "requiresDocker": false },
    { "id": "tank", "label": "TANK — infra stack", "script": "tank:up", "requiresDocker": true }
  ]
}
```

- [ ] **Step 2: Write the failing test**

Create `test/agents.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadAgents, filterAgents, findAgent } = require('../lib/agents');

const FIXTURE = path.join(__dirname, 'fixtures', 'aixmos');

test('loadAgents reads the manifest array', () => {
  const agents = loadAgents(FIXTURE);
  assert.strictEqual(agents.length, 2);
  assert.strictEqual(agents[0].id, 'jarvis');
});

test('loadAgents throws when the manifest is missing', () => {
  assert.throws(() => loadAgents('/no/such/dir'), /manifest not found/i);
});

test('loadAgents throws on malformed JSON', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmmt-agents-'));
  fs.writeFileSync(path.join(dir, 'tmmt.agents.json'), '{ not json');
  assert.throws(() => loadAgents(dir), /valid JSON/i);
});

test('filterAgents drops Docker agents when Docker is unavailable', () => {
  const filtered = filterAgents(loadAgents(FIXTURE), { dockerAvailable: false });
  assert.deepStrictEqual(filtered.map((a) => a.id), ['jarvis']);
});

test('filterAgents keeps all agents when Docker is available', () => {
  const filtered = filterAgents(loadAgents(FIXTURE), { dockerAvailable: true });
  assert.strictEqual(filtered.length, 2);
});

test('findAgent locates by id and returns undefined otherwise', () => {
  const agents = loadAgents(FIXTURE);
  assert.strictEqual(findAgent(agents, 'tank').id, 'tank');
  assert.strictEqual(findAgent(agents, 'nope'), undefined);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test test/agents.test.js`
Expected: FAIL — `Cannot find module '../lib/agents'`.

- [ ] **Step 4: Write `lib/agents.js`**

```js
const fs = require('fs');
const path = require('path');

function manifestPath(aixmosPath) {
  return path.join(aixmosPath, 'tmmt.agents.json');
}

function loadAgents(aixmosPath) {
  const file = manifestPath(aixmosPath);
  if (!fs.existsSync(file)) {
    throw new Error(
      `Agent manifest not found: ${file}\n` +
      'Add tmmt.agents.json to the AIXMOS-AGENTS repo.'
    );
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Agent manifest is not valid JSON: ${file}\n${err.message}`);
  }
  if (!data || !Array.isArray(data.agents)) {
    throw new Error(`Agent manifest must contain an "agents" array: ${file}`);
  }
  return data.agents;
}

function filterAgents(agents, deviceConfig) {
  if (deviceConfig && deviceConfig.dockerAvailable) return agents.slice();
  return agents.filter((agent) => !agent.requiresDocker);
}

function findAgent(agents, id) {
  return agents.find((agent) => agent.id === id);
}

module.exports = { manifestPath, loadAgents, filterAgents, findAgent };
```

- [ ] **Step 5: Run the test to verify it passes, then commit**

Run: `node --test test/agents.test.js`
Expected: PASS — 6 tests pass.

```bash
git add lib/agents.js test/agents.test.js test/fixtures/aixmos/tmmt.agents.json
git commit -m "feat: add agent manifest loading and Docker filtering"
```

---

## Task 4: `lib/run.js` — build and spawn the agent command

**Files:**
- Create: `lib/run.js`
- Test: `test/run.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/run.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('events');
const { buildRunCommand, runAgent } = require('../lib/run');

const agent = { id: 'jarvis', script: 'jarvis' };
const device = {
  aixmosPath: '/x/AIXMOS-AGENTS',
  ollamaHost: 'http://h:1',
  ollamaModel: 'm',
};

test('buildRunCommand targets npm run <script> in the AIXMOS dir', () => {
  const cmd = buildRunCommand(agent, device, 'darwin');
  assert.strictEqual(cmd.command, 'npm');
  assert.deepStrictEqual(cmd.args, ['run', 'jarvis']);
  assert.strictEqual(cmd.cwd, '/x/AIXMOS-AGENTS');
});

test('buildRunCommand uses npm.cmd on Windows', () => {
  assert.strictEqual(buildRunCommand(agent, device, 'win32').command, 'npm.cmd');
});

test('buildRunCommand forces the Ollama backend env', () => {
  const env = buildRunCommand(agent, device, 'darwin').env;
  assert.strictEqual(env.AIXMOS_LLM_BACKEND, 'ollama');
  assert.strictEqual(env.OLLAMA_HOST, 'http://h:1');
  assert.strictEqual(env.OLLAMA_MODEL, 'm');
});

test('runAgent resolves with the child exit code', async () => {
  const fakeChild = new EventEmitter();
  const spawnFn = () => fakeChild;
  const promise = runAgent(agent, device, spawnFn);
  setImmediate(() => fakeChild.emit('exit', 3));
  assert.strictEqual(await promise, 3);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/run.test.js`
Expected: FAIL — `Cannot find module '../lib/run'`.

- [ ] **Step 3: Write `lib/run.js`**

```js
const { spawn } = require('child_process');

function buildRunCommand(agent, deviceConfig, platform = process.platform) {
  return {
    command: platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', agent.script],
    cwd: deviceConfig.aixmosPath,
    env: {
      ...process.env,
      AIXMOS_LLM_BACKEND: 'ollama',
      OLLAMA_HOST: deviceConfig.ollamaHost,
      OLLAMA_MODEL: deviceConfig.ollamaModel,
    },
  };
}

function runAgent(agent, deviceConfig, spawnFn = spawn) {
  const { command, args, cwd, env } = buildRunCommand(agent, deviceConfig);
  return new Promise((resolve, reject) => {
    const child = spawnFn(command, args, { cwd, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code == null ? 0 : code));
  });
}

module.exports = { buildRunCommand, runAgent };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/run.test.js`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/run.js test/run.test.js
git commit -m "feat: add agent run command builder and spawner"
```

---

## Task 5: `lib/menu.js` — render the menu and parse selections

**Files:**
- Create: `lib/menu.js`
- Test: `test/menu.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/menu.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { renderMenu, parseSelection } = require('../lib/menu');

const agents = [
  { id: 'jarvis', label: 'JARVIS — ops assistant' },
  { id: 'moose', label: 'MOOSE' },
];
const device = {
  role: 'home', aixmosPath: '/x',
  ollamaHost: 'http://h', ollamaModel: 'm',
};

test('renderMenu shows the role header and numbered agents', () => {
  const out = renderMenu(agents, device);
  assert.match(out, /TMMT AI Runtime — HOME/);
  assert.match(out, /1\) JARVIS — ops assistant/);
  assert.match(out, /2\) MOOSE/);
  assert.match(out, /q\) quit/);
});

test('parseSelection maps a number to the agent', () => {
  assert.deepStrictEqual(parseSelection('1', agents), { action: 'run', agent: agents[0] });
  assert.deepStrictEqual(parseSelection('2', agents), { action: 'run', agent: agents[1] });
});

test('parseSelection recognizes quit', () => {
  assert.strictEqual(parseSelection('q', agents).action, 'quit');
  assert.strictEqual(parseSelection('QUIT', agents).action, 'quit');
});

test('parseSelection rejects out-of-range and non-numeric input', () => {
  assert.strictEqual(parseSelection('99', agents).action, 'invalid');
  assert.strictEqual(parseSelection('abc', agents).action, 'invalid');
  assert.strictEqual(parseSelection('0', agents).action, 'invalid');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/menu.test.js`
Expected: FAIL — `Cannot find module '../lib/menu'`.

- [ ] **Step 3: Write `lib/menu.js`**

```js
function renderMenu(agents, deviceConfig) {
  const role = String(deviceConfig.role || 'unknown').toUpperCase();
  const lines = [];
  lines.push(`TMMT AI Runtime — ${role}`);
  lines.push(
    `AIXMOS-AGENTS: ${deviceConfig.aixmosPath}   ` +
    `Ollama: ${deviceConfig.ollamaHost} / ${deviceConfig.ollamaModel}`
  );
  lines.push('');
  agents.forEach((agent, i) => {
    lines.push(`  ${i + 1}) ${agent.label}`);
  });
  lines.push('');
  lines.push('  q) quit');
  return lines.join('\n');
}

function parseSelection(input, agents) {
  const trimmed = String(input).trim().toLowerCase();
  if (trimmed === 'q' || trimmed === 'quit') return { action: 'quit' };
  const n = Number(trimmed);
  if (Number.isInteger(n) && n >= 1 && n <= agents.length) {
    return { action: 'run', agent: agents[n - 1] };
  }
  return { action: 'invalid' };
}

module.exports = { renderMenu, parseSelection };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/menu.test.js`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/menu.js test/menu.test.js
git commit -m "feat: add menu rendering and selection parsing"
```

---

## Task 6: `tmmt.js` — the CLI entry point

**Files:**
- Create: `tmmt.js`
- Test: `test/cli.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/cli.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.join(__dirname, '..');

function runCli(args, runtimeDir) {
  try {
    const stdout = execFileSync('node', ['tmmt.js', ...args], {
      cwd: REPO,
      env: { ...process.env, TMMT_RUNTIME_DIR: runtimeDir },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    return { code: err.status, stdout: err.stdout || '', stderr: err.stderr || '' };
  }
}

test('tmmt exits with guidance when DEVICE_ROLE.md is missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmmt-cli-'));
  const result = runCli([], dir);
  assert.strictEqual(result.code, 1);
  assert.match(result.stderr, /No DEVICE_ROLE\.md/);
});

test('tmmt rejects an unknown agent name', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmmt-cli-'));
  const fixture = path.join(REPO, 'test', 'fixtures', 'aixmos');
  const deviceRole = [
    '---', 'role: home', 'os: darwin', 'hostname: test',
    `aixmosPath: ${fixture}`,
    'ollamaHost: http://localhost:11434', 'ollamaModel: llama3.2:3b',
    'dockerAvailable: true', 'generatedAt: 2026-05-22T00:00:00Z',
    '---', '# test',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'DEVICE_ROLE.md'), deviceRole);
  const result = runCli(['nonexistent-agent'], dir);
  assert.strictEqual(result.code, 1);
  assert.match(result.stderr, /Unknown agent/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/cli.test.js`
Expected: FAIL — `node tmmt.js` errors with `Cannot find module '.../tmmt.js'`, so `result.code` is not 1 as asserted (it is `1` from node itself but `stderr` will not match `/No DEVICE_ROLE\.md/`). The test fails on the `assert.match`.

- [ ] **Step 3: Write `tmmt.js`**

```js
#!/usr/bin/env node
const readline = require('readline');
const { readDeviceRole } = require('./lib/device');
const { loadAgents, filterAgents, findAgent } = require('./lib/agents');
const { renderMenu, parseSelection } = require('./lib/menu');
const { runAgent } = require('./lib/run');

const RUNTIME_DIR = process.env.TMMT_RUNTIME_DIR || __dirname;

function promptLine(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function menuLoop(agents, deviceConfig) {
  for (;;) {
    console.log('\n' + renderMenu(agents, deviceConfig) + '\n');
    const choice = parseSelection(await promptLine('Select: '), agents);
    if (choice.action === 'quit') return 0;
    if (choice.action === 'invalid') {
      console.log('Invalid selection.');
      continue;
    }
    const code = await runAgent(choice.agent, deviceConfig);
    if (code !== 0) console.log(`\n[${choice.agent.id} exited with code ${code}]`);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === 'setup') {
    await require('./setup').run();
    return;
  }

  const deviceConfig = readDeviceRole(RUNTIME_DIR);
  if (!deviceConfig) {
    console.error('No DEVICE_ROLE.md found. Run:  node setup.js   (or: tmmt setup)');
    process.exit(1);
  }

  let allAgents;
  try {
    allAgents = loadAgents(deviceConfig.aixmosPath);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const agents = filterAgents(allAgents, deviceConfig);

  if (args.length === 0) {
    process.exit(await menuLoop(agents, deviceConfig));
  }

  const agent = findAgent(agents, args[0]);
  if (!agent) {
    if (findAgent(allAgents, args[0])) {
      console.error(`Agent "${args[0]}" requires Docker, which is not available on this device.`);
    } else {
      console.error(`Unknown agent: ${args[0]}`);
      console.error('Available: ' + agents.map((a) => a.id).join(', '));
    }
    process.exit(1);
  }
  process.exit(await runAgent(agent, deviceConfig));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/cli.test.js`
Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tmmt.js test/cli.test.js
git commit -m "feat: add tmmt CLI entry point with menu and subcommands"
```

---

## Task 7: `setup.js` — per-device setup script

**Files:**
- Create: `setup.js`
- Test: `test/setup.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/setup.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseDeviceRole } = require('../lib/device');

const REPO = path.join(__dirname, '..');

test('setup writes a parseable DEVICE_ROLE.md from piped answers', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmmt-setup-'));
  const answers = ['home', '/tmp/AIXMOS-AGENTS', 'http://localhost:11434', 'llama3.2:3b'].join('\n') + '\n';
  execFileSync('node', ['setup.js'], {
    cwd: REPO,
    env: { ...process.env, TMMT_RUNTIME_DIR: dir },
    input: answers,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const file = path.join(dir, 'DEVICE_ROLE.md');
  assert.ok(fs.existsSync(file), 'DEVICE_ROLE.md should be written');
  const cfg = parseDeviceRole(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(cfg.role, 'home');
  assert.strictEqual(cfg.aixmosPath, '/tmp/AIXMOS-AGENTS');
  assert.strictEqual(cfg.ollamaModel, 'llama3.2:3b');
});

test('setup refuses to overwrite an existing DEVICE_ROLE.md without --force', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmmt-setup-'));
  fs.writeFileSync(path.join(dir, 'DEVICE_ROLE.md'), 'PRE-EXISTING');
  execFileSync('node', ['setup.js'], {
    cwd: REPO,
    env: { ...process.env, TMMT_RUNTIME_DIR: dir },
    input: '\n\n\n\n',
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  assert.strictEqual(fs.readFileSync(path.join(dir, 'DEVICE_ROLE.md'), 'utf8'), 'PRE-EXISTING');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/setup.test.js`
Expected: FAIL — `Cannot find module '.../setup.js'`.

- [ ] **Step 3: Write `setup.js`**

```js
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');
const { detectRole, writeDeviceRole, deviceRolePath } = require('./lib/device');

const RUNTIME_DIR = process.env.TMMT_RUNTIME_DIR || __dirname;

function dockerAvailable() {
  try {
    execSync(process.platform === 'win32' ? 'where docker' : 'command -v docker', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function detectAixmosPath() {
  const candidates = process.platform === 'win32'
    ? ['D:\\AIXMOS-AGENTS', path.join(os.homedir(), 'AIXMOS-AGENTS')]
    : [path.join(os.homedir(), 'AIXMOS-AGENTS')];
  return candidates.find((c) => fs.existsSync(c)) || null;
}

function ask(rl, question, fallback) {
  const suffix = fallback ? ` [${fallback}]` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || fallback || '');
    });
  });
}

async function run() {
  const force = process.argv.slice(2).includes('--force');
  const file = deviceRolePath(RUNTIME_DIR);
  if (fs.existsSync(file) && !force) {
    console.log(`DEVICE_ROLE.md already exists at ${file}`);
    console.log('Re-run with --force to overwrite it.');
    return;
  }

  const hostname = os.hostname();
  const guessedRole = detectRole(hostname) || 'carry';
  console.log(`Detected hostname: ${hostname}`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let config;
  try {
    const role = await ask(rl, 'Device role (home / work / carry)', guessedRole);
    const aixmosPath = await ask(rl, 'Path to AIXMOS-AGENTS', detectAixmosPath() || '');
    const ollamaHost = await ask(rl, 'Ollama host', 'http://localhost:11434');
    const ollamaModel = await ask(rl, 'Ollama model', 'llama3.2:3b');
    config = {
      role,
      os: process.platform,
      hostname,
      aixmosPath,
      ollamaHost,
      ollamaModel,
      dockerAvailable: dockerAvailable(),
      generatedAt: new Date().toISOString(),
    };
  } finally {
    rl.close();
  }

  writeDeviceRole(RUNTIME_DIR, config);
  console.log(`\nWrote ${file}`);
  console.log(`  role: ${config.role}   docker: ${config.dockerAvailable}`);
  if (!config.aixmosPath || !fs.existsSync(config.aixmosPath)) {
    console.log('  WARNING: AIXMOS-AGENTS path not found — edit DEVICE_ROLE.md to fix it.');
  }
  console.log('\nRun  node tmmt.js  (or double-click tmmt.command / tmmt.bat) to launch.');
}

module.exports = { run, dockerAvailable, detectAixmosPath };

if (require.main === module) {
  run();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/setup.test.js`
Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add setup.js test/setup.test.js
git commit -m "feat: add per-device setup script"
```

---

## Task 8: Double-click wrappers

**Files:**
- Create: `tmmt.command`, `tmmt.bat`, `setup.command`, `setup.bat`

- [ ] **Step 1: Create `tmmt.command`**

```bash
#!/bin/bash
cd "$(dirname "$0")"
node tmmt.js "$@"
```

- [ ] **Step 2: Create `setup.command`**

```bash
#!/bin/bash
cd "$(dirname "$0")"
node setup.js "$@"
```

- [ ] **Step 3: Create `tmmt.bat`**

```bat
@echo off
cd /d "%~dp0"
node tmmt.js %*
```

- [ ] **Step 4: Create `setup.bat`**

```bat
@echo off
cd /d "%~dp0"
node setup.js %*
```

- [ ] **Step 5: Make the macOS wrappers executable and commit**

```bash
chmod +x tmmt.command setup.command
git add tmmt.command tmmt.bat setup.command setup.bat
git update-index --chmod=+x tmmt.command setup.command
git commit -m "feat: add macOS and Windows double-click wrappers"
```

---

## Task 9: Add the agent manifest to the AIXMOS-AGENTS repo

**Files:**
- Create: `/Users/ceo.moe/AIXMOS-AGENTS/tmmt.agents.json` (**sibling repo, not this one**)

This file is committed to the `AIXMOS-AGENTS` repo, not `TMMT-AI-RUNTIME`. The agent ids and scripts below were taken from `~/AIXMOS-AGENTS/package.json`. `tank` is the only Docker-dependent entry (`tank:up` starts the n8n + Open WebUI Docker stack).

- [ ] **Step 1: Create `/Users/ceo.moe/AIXMOS-AGENTS/tmmt.agents.json`**

```json
{
  "agents": [
    { "id": "jarvis", "label": "JARVIS — ops assistant", "script": "jarvis", "requiresDocker": false },
    { "id": "moose", "label": "MOOSE", "script": "moose", "requiresDocker": false },
    { "id": "vision", "label": "VISION", "script": "vision", "requiresDocker": false },
    { "id": "captain", "label": "CAPTAIN", "script": "captain", "requiresDocker": false },
    { "id": "wonderwoman", "label": "WONDER WOMAN", "script": "wonderwoman", "requiresDocker": false },
    { "id": "flyguy", "label": "FLYGUY", "script": "flyguy", "requiresDocker": false },
    { "id": "bob", "label": "BOB", "script": "bob", "requiresDocker": false },
    { "id": "sticks", "label": "STICKS — overdue scan", "script": "sticks", "requiresDocker": false },
    { "id": "brief", "label": "BRIEFING — daily briefing", "script": "brief", "requiresDocker": false },
    { "id": "contacts", "label": "CONTACTS", "script": "contacts", "requiresDocker": false },
    { "id": "scheduler", "label": "SCHEDULER — scheduled jobs", "script": "scheduler", "requiresDocker": false },
    { "id": "chummo", "label": "CHUMMO", "script": "chummo", "requiresDocker": false },
    { "id": "tank", "label": "TANK — infra stack (Docker)", "script": "tank:up", "requiresDocker": true }
  ]
}
```

- [ ] **Step 2: Verify the launcher reads it**

Run: `node -e "console.log(require('./lib/agents').loadAgents('/Users/ceo.moe/AIXMOS-AGENTS').length)"`
Expected: prints `13`.

- [ ] **Step 3: Commit in the AIXMOS-AGENTS repo**

```bash
cd /Users/ceo.moe/AIXMOS-AGENTS
git add tmmt.agents.json
git commit -m "feat: add tmmt.agents.json manifest for TMMT-AI-RUNTIME launcher"
cd /Users/ceo.moe/TMMT-AI-RUNTIME
```

If `AIXMOS-AGENTS` has a pre-commit hook or staged changes that block the commit, leave the file in place uncommitted and note it — do not use `--no-verify`.

---

## Task 10: README.md

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# TMMT-AI-RUNTIME

Unified launcher for the AIXMOS agents across the TMMT machine fleet
(Brainiac 7 / Coding Brain / Mobile Control Station).

## Install on a machine

1. `git clone` this repo (or copy the folder).
2. Run setup once:  `node setup.js`  (or double-click `setup.command` / `setup.bat`).
   It detects the device and writes a git-ignored `DEVICE_ROLE.md`.

## Use

- `node tmmt.js` — interactive numbered menu of agents.
- `node tmmt.js <agent>` — run one agent directly, e.g. `node tmmt.js jarvis`.
- Double-click `tmmt.command` (macOS) or `tmmt.bat` (Windows) for the menu.

## How it works

The launcher reads `DEVICE_ROLE.md` for this machine, reads the agent list from
`tmmt.agents.json` in the AIXMOS-AGENTS repo, hides Docker-only agents where
Docker is not installed, and runs the chosen agent with `npm run <script>` and
the Ollama backend (`AIXMOS_LLM_BACKEND=ollama`).

## Tests

`npm test`  (runs `node --test`).

## Design docs

- Spec: `docs/superpowers/specs/2026-05-22-tmmt-ai-runtime-design.md`
- Plan: `docs/superpowers/plans/2026-05-22-tmmt-ai-runtime.md`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Task 11: Full verification

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all suites pass — `device`, `agents`, `run`, `menu`, `cli`, `setup`. Confirm the summary shows `pass` count equal to total tests and `fail 0`.

- [ ] **Step 2: Smoke-test setup + launch against the real AIXMOS-AGENTS**

```bash
node setup.js
```
Answer the prompts (role, AIXMOS path `/Users/ceo.moe/AIXMOS-AGENTS`, Ollama defaults). Then:
```bash
node tmmt.js
```
Expected: the menu lists the agents from `tmmt.agents.json`. On a machine without Docker the `tank` entry is absent. Choose `q` to quit without running an agent.

- [ ] **Step 3: Final commit if anything is uncommitted**

```bash
git status --short
git add -A && git commit -m "chore: finalize TMMT-AI-RUNTIME v1" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Spec coverage:** launcher CLI (Tasks 6), both menu + subcommands (Tasks 5–6), `setup.js` writing `DEVICE_ROLE.md` (Task 7), auto-discovered manifest (Tasks 3, 9), per-device Ollama wiring + Docker filtering (Tasks 3–4, 6), error handling (Tasks 3, 6), `node:test` coverage (every task), wrappers (Task 8), README (Task 10). All spec sections map to a task.
- **Out of scope confirmed:** no brain-dump agent, no infra-stack command, no doctor, no home-folder inventory, no NAS / extra env vars — matches the spec's deferred list.
- **Type consistency:** `deviceConfig` shape (`role`, `os`, `hostname`, `aixmosPath`, `ollamaHost`, `ollamaModel`, `dockerAvailable`, `generatedAt`) is identical across `device.js`, `run.js`, `menu.js`, `tmmt.js`, `setup.js`. Agent shape (`id`, `label`, `script`, `requiresDocker`) is identical across `agents.js`, `menu.js`, `run.js`, the fixture, and the real manifest. `TMMT_RUNTIME_DIR` test seam is used identically in `tmmt.js` and `setup.js`.
