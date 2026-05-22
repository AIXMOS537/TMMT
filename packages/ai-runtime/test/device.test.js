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
