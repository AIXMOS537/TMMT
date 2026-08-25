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

const KNOWN_ROLES = ['home', 'work', 'carry'];

function validateDeviceConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('DEVICE_ROLE.md produced no config');
  }
  for (const field of ['role', 'aixmosPath', 'ollamaHost', 'ollamaModel']) {
    if (!config[field] || typeof config[field] !== 'string') {
      throw new Error(`DEVICE_ROLE.md is missing required field "${field}"`);
    }
  }
  if (!KNOWN_ROLES.includes(config.role)) {
    throw new Error(`DEVICE_ROLE.md has unknown role "${config.role}" (expected one of: ${KNOWN_ROLES.join(', ')})`);
  }
  if (!/^https?:\/\//.test(config.ollamaHost)) {
    throw new Error(`DEVICE_ROLE.md ollamaHost "${config.ollamaHost}" must be a full http(s) URL`);
  }
  return config;
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
  validateDeviceConfig,
  deviceRolePath,
  readDeviceRole,
  writeDeviceRole,
};
