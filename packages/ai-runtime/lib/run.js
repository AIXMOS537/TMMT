const { spawn } = require('child_process');

function buildRunCommand(agent, deviceConfig, platform = process.platform) {
  return {
    command: platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', agent.script],
    cwd: deviceConfig.aixmosPath,
    env: {
      ...process.env,
      AIXMOS_LLM_BACKEND: 'ollama',
      OLLAMA_HOST: deviceConfig.ollamaHost,
      OLLAMA_MODEL: deviceConfig.ollamaModel,
    },
  };
}

function runAgent(agent, deviceConfig, spawnFn = spawn) {
  const { command, args, cwd, env } = buildRunCommand(agent, deviceConfig);
  return new Promise((resolve, reject) => {
    const child = spawnFn(command, args, { cwd, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code == null ? 0 : code));
  });
}

module.exports = { buildRunCommand, runAgent };
