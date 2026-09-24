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
    '---',
    'role: home',
    'os: darwin',
    'hostname: test',
    `aixmosPath: ${fixture}`,
    'ollamaHost: http://localhost:11434',
    'ollamaModel: llama3.2:3b',
    'dockerAvailable: true',
    'generatedAt: 2026-05-22T00:00:00Z',
    '---',
    '# test',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'DEVICE_ROLE.md'), deviceRole);
  const result = runCli(['nonexistent-agent'], dir);
  assert.strictEqual(result.code, 1);
  assert.match(result.stderr, /Unknown agent/);
});
