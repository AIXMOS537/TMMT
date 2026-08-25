const { spawn } = require('child_process');

const TRUSTED_HOST_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1|100\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?\/?$/;

function warnIfUntrustedHost(ollamaHost) {
  if (ollamaHost && !TRUSTED_HOST_PATTERN.test(ollamaHost)) {
    console.error(
      `[tmmt] WARNING: OLLAMA_HOST "${ollamaHost}" is not localhost or a Tailscale fleet address (100.x.x.x). ` +
      'Double-check DEVICE_ROLE.md before agent traffic leaves this machine.'
    );
  }
}

function buildRunCommand(agent, deviceConfig, platform = process.platform) {
  warnIfUntrustedHost(deviceConfig.ollamaHost);
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
