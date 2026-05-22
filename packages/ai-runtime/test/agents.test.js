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
