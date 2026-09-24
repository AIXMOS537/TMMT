const test = require('node:test');
const assert = require('node:assert');
const { renderMenu, parseSelection } = require('../lib/menu');

const agents = [
  { id: 'jarvis', label: 'JARVIS - ops assistant' },
  { id: 'moose', label: 'MOOSE' },
];
const device = {
  role: 'home',
  aixmosPath: '/x',
  ollamaHost: 'http://h',
  ollamaModel: 'm',
};

test('renderMenu shows the role header and numbered agents', () => {
  const out = renderMenu(agents, device);
  assert.match(out, /TMMT AI Runtime - HOME/);
  assert.match(out, /1\) JARVIS - ops assistant/);
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
