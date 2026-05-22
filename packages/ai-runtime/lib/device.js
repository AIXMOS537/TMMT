const fs = require('fs');
const path = require('path');

const ROLE_HINTS = [
  { role: 'home', pattern: /brainiac/i },
  { role: 'work', pattern: /coding/i },
  { role: 'carry', pattern: /mobile|control/i },
];

const FIELDS = [
  'role',
  'os',
  'hostname',
  'aixmosPath',
  'ollamaHost',
  'ollamaModel',
  'dockerAvailable',
  'generatedAt',
];

function detectRole(hostname) {
  for (const { role, pattern } of ROLE_HINTS) {
    if (pattern.test(hostname || '')) return role;
  }
  return null;
}

function parseDeviceRole(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error('DEVICE_ROLE.md has no frontmatter block');
  }

  const config = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    config[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  config.dockerAvailable = config.dockerAvailable === 'true';
  return config;
}

function formatDeviceRole(config) {
  const lines = ['---'];
  for (const key of FIELDS) {
    const value = key === 'dockerAvailable'
      ? String(Boolean(config[key]))
      : (config[key] == null ? '' : config[key]);
    lines.push(`${key}: ${value}`);
  }
  lines.push('---');
  lines.push(`# This machine: ${String(config.role || 'unknown').toUpperCase()}`);
  lines.push('');
  lines.push('Edit the frontmatter above to change how the launcher behaves on');
  lines.push('this machine. This file is git-ignored - per-device, never committed.');
  lines.push('');
  return lines.join('\n');
}

function deviceRolePath(runtimeDir) {
  return path.join(runtimeDir, 'DEVICE_ROLE.md');
}

function readDeviceRole(runtimeDir) {
  const file = deviceRolePath(runtimeDir);
  if (!fs.existsSync(file)) return null;
  return parseDeviceRole(fs.readFileSync(file, 'utf8'));
}

function writeDeviceRole(runtimeDir, config) {
  fs.writeFileSync(deviceRolePath(runtimeDir), formatDeviceRole(config));
}

module.exports = {
  detectRole,
  parseDeviceRole,
  formatDeviceRole,
  deviceRolePath,
  readDeviceRole,
  writeDeviceRole,
};
