function renderMenu(agents, deviceConfig) {
  const role = String(deviceConfig.role || 'unknown').toUpperCase();
  const lines = [];
  lines.push(`TMMT AI Runtime - ${role}`);
  lines.push(
    `AIXMOS-AGENTS: ${deviceConfig.aixmosPath}   ` +
    `Ollama: ${deviceConfig.ollamaHost} / ${deviceConfig.ollamaModel}`
  );
  lines.push('');
  agents.forEach((agent, i) => {
    lines.push(`  ${i + 1}) ${agent.label}`);
  });
  lines.push('');
  lines.push('  q) quit');
  return lines.join('\n');
}

function parseSelection(input, agents) {
  const trimmed = String(input).trim().toLowerCase();
  if (trimmed === 'q' || trimmed === 'quit') return { action: 'quit' };
  const n = Number(trimmed);
  if (Number.isInteger(n) && n >= 1 && n <= agents.length) {
    return { action: 'run', agent: agents[n - 1] };
  }
  return { action: 'invalid' };
}

module.exports = { renderMenu, parseSelection };
