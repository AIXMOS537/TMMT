const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');
const { detectRole, writeDeviceRole, deviceRolePath } = require('./lib/device');

const RUNTIME_DIR = process.env.TMMT_RUNTIME_DIR || __dirname;

function dockerAvailable() {
  try {
    execSync(process.platform === 'win32' ? 'where docker' : 'command -v docker', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function detectAixmosPath() {
  const candidates = process.platform === 'win32'
    ? ['D:\\AIXMOS-AGENTS', path.join(os.homedir(), 'AIXMOS-AGENTS')]
    : [path.join(os.homedir(), 'AIXMOS-AGENTS')];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function ask(rl, question, fallback) {
  const suffix = fallback ? ` [${fallback}]` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || fallback || '');
    });
  });
}

function readScriptedAnswers() {
  if (process.stdin.isTTY) return null;
  return fs.readFileSync(0, 'utf8').split(/\r?\n/);
}

async function run() {
  const force = process.argv.slice(2).includes('--force');
  const file = deviceRolePath(RUNTIME_DIR);
  if (fs.existsSync(file) && !force) {
    console.log(`DEVICE_ROLE.md already exists at ${file}`);
    console.log('Re-run with --force to overwrite it.');
    return;
  }

  const hostname = os.hostname();
  const guessedRole = detectRole(hostname) || 'carry';
  console.log(`Detected hostname: ${hostname}`);

  const scriptedAnswers = readScriptedAnswers();
  let scriptedIndex = 0;
  const rl = scriptedAnswers
    ? null
    : readline.createInterface({ input: process.stdin, output: process.stdout });
  const prompt = scriptedAnswers
    ? async (_question, fallback) => {
      const answer = scriptedAnswers[scriptedIndex++] || '';
      return answer.trim() || fallback || '';
    }
    : (question, fallback) => ask(rl, question, fallback);
  let config;
  try {
    const role = await prompt('Device role (home / work / carry)', guessedRole);
    const aixmosPath = await prompt('Path to AIXMOS-AGENTS', detectAixmosPath() || '');
    const ollamaHost = await prompt('Ollama host', 'http://localhost:11434');
    const ollamaModel = await prompt('Ollama model', 'llama3.2:3b');
    config = {
      role,
      os: process.platform,
      hostname,
      aixmosPath,
      ollamaHost,
      ollamaModel,
      dockerAvailable: dockerAvailable(),
      generatedAt: new Date().toISOString(),
    };
  } finally {
    if (rl) rl.close();
  }

  writeDeviceRole(RUNTIME_DIR, config);
  console.log(`\nWrote ${file}`);
  console.log(`  role: ${config.role}   docker: ${config.dockerAvailable}`);
  if (!config.aixmosPath || !fs.existsSync(config.aixmosPath)) {
    console.log('  WARNING: AIXMOS-AGENTS path not found - edit DEVICE_ROLE.md to fix it.');
  }
  console.log('\nRun  node tmmt.js  (or double-click tmmt.command / tmmt.bat) to launch.');
}

module.exports = { run, dockerAvailable, detectAixmosPath };

if (require.main === module) {
  run();
}
