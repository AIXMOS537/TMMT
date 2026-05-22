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
