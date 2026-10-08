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
