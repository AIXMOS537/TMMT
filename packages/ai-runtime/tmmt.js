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
