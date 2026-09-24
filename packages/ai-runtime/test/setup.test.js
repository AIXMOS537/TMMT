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
