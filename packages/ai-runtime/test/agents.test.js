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

function writeManifest(agents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmmt-agents-'));
  fs.writeFileSync(path.join(dir, 'tmmt.agents.json'), JSON.stringify({ agents }));
  return dir;
}

test('loadAgents rejects an entry with a script that would not survive npm run', () => {
  const dir = writeManifest([{ id: 'x', label: 'X', script: 'rm -rf /' }]);
  assert.throws(() => loadAgents(dir), /"script" must match/);
});

test('loadAgents rejects an entry missing a label', () => {
  const dir = writeManifest([{ id: 'x', script: 'x' }]);
  assert.throws(() => loadAgents(dir), /missing string "label"/);
});

test('loadAgents rejects requiresDocker that is not a boolean', () => {
  const dir = writeManifest([{ id: 'x', label: 'X', script: 'x', requiresDocker: 'yes' }]);
  assert.throws(() => loadAgents(dir), /"requiresDocker" must be a boolean/);
});

test('loadAgents accepts a script with allowed colon/dash/underscore characters', () => {
  const dir = writeManifest([{ id: 'x', label: 'X', script: 'tank:up_v2' }]);
  assert.strictEqual(loadAgents(dir)[0].script, 'tank:up_v2');
});
