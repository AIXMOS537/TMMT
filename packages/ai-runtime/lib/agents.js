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

  data.agents.forEach((agent, i) => validateAgentEntry(agent, i, file));

  return data.agents;
}

const SCRIPT_PATTERN = /^[A-Za-z0-9:_-]+$/;

function validateAgentEntry(agent, index, file) {
  const where = `${file} (agents[${index}])`;
  if (!agent || typeof agent.id !== 'string' || !agent.id) {
    throw new Error(`Invalid agent manifest entry, missing string "id": ${where}`);
  }
  if (typeof agent.label !== 'string' || !agent.label) {
    throw new Error(`Invalid agent manifest entry "${agent.id}", missing string "label": ${where}`);
  }
  if (typeof agent.script !== 'string' || !SCRIPT_PATTERN.test(agent.script)) {
    throw new Error(
      `Invalid agent manifest entry "${agent.id}": "script" must match ${SCRIPT_PATTERN} (this is fed to \`npm run <script>\`): ${where}`
    );
  }
  if ('requiresDocker' in agent && typeof agent.requiresDocker !== 'boolean') {
    throw new Error(`Invalid agent manifest entry "${agent.id}", "requiresDocker" must be a boolean: ${where}`);
  }
}

function filterAgents(agents, deviceConfig) {
  if (deviceConfig && deviceConfig.dockerAvailable) return agents.slice();
  return agents.filter((agent) => !agent.requiresDocker);
}

function findAgent(agents, id) {
  return agents.find((agent) => agent.id === id);
}

module.exports = { manifestPath, loadAgents, filterAgents, findAgent };
