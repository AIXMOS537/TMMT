/* AIXMOS Command Center — add-operator.js
 *
 *   node tools/add-operator.js "Sara Ahmed"
 *   node tools/add-operator.js "Dev Patel" dispatch
 *   node tools/add-operator.js "Ana Cruz" operator --subtitle "TMMT · Detailer"
 *
 * Adds one person to tools/profiles.json and rebuilds every console, so a new
 * hire's console exists about four seconds after you know their name.
 *
 * This provisions a CONSOLE. It does not grant access to anything — the console
 * only shows links, and every system behind those links has its own account.
 * See ONBOARDING.md for the rest of the checklist.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PROFILES = path.join(ROOT, 'tools', 'profiles.json');

const ROLES = ['owner', 'manager', 'dispatch', 'operator', 'sales', 'family', 'friend', 'vendor'];
const DEFAULT_SUBTITLE = {
  manager: 'TMMT · Manager',
  dispatch: 'TMMT · Dispatch',
  operator: 'TMMT · Detailer',
  sales: 'TMMT · Sales',
  vendor: 'TMMT · Vendor',
  family: 'Family',
  friend: 'Friend',
  owner: 'AIXMOS · TMMT'
};

function die(message) {
  console.error('\n  ' + message + '\n');
  process.exit(1);
}

/* ---- arguments ---- */
const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--subtitle') { flags.subtitle = argv[++i]; }
  else if (argv[i] === '--accent') { flags.accent = argv[++i]; }
  else if (argv[i].startsWith('--')) { die(`Unknown flag ${argv[i]}`); }
  else { positional.push(argv[i]); }
}

const fullName = (positional[0] || '').trim();
const role = (positional[1] || 'operator').toLowerCase();

if (!fullName) {
  die('Usage: node tools/add-operator.js "Full Name" [role] [--subtitle "..."]\n' +
      '  roles: ' + ROLES.join(' | '));
}
if (ROLES.indexOf(role) === -1) {
  die(`"${role}" is not a role. Pick one of: ${ROLES.join(', ')}`);
}
if (flags.accent && !/^#[0-9a-fA-F]{6}$/.test(flags.accent)) {
  die('--accent must be a 6-digit hex colour like #3ddc97');
}

/* ---- derive the file name ---- */
const parts = fullName.split(/\s+/).filter(Boolean);
const slug = parts
  .map((w) => w.replace(/[^A-Za-z0-9]/g, ''))
  .filter(Boolean)
  .map((w) => w[0].toUpperCase() + w.slice(1))
  .join('-');
if (!slug) { die('That name has no letters in it.'); }

const file = `Dashboard-${slug}.html`;

/* ---- add to the roster ---- */
const profiles = JSON.parse(fs.readFileSync(PROFILES, 'utf8'));

const clash = profiles.find((p) => p.file.toLowerCase() === file.toLowerCase());
if (clash) {
  die(`${file} already exists on the roster (${clash.name}, ${clash.role}).\n` +
      '  Edit tools/profiles.json directly if you meant to change their role.');
}

profiles.push({
  file,
  name: parts[0],
  role,
  subtitle: flags.subtitle || DEFAULT_SUBTITLE[role] || 'AIXMOS · TMMT',
  accent: flags.accent || '',
  extraTiles: []
});

fs.writeFileSync(PROFILES, JSON.stringify(profiles, null, 2) + '\n', 'utf8');
console.log(`\n  Added ${fullName} to the roster as ${role}.`);

/* ---- rebuild ---- */
const build = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build-consoles.js')], {
  cwd: ROOT,
  stdio: 'inherit'
});
if (build.status !== 0) {
  die('The rebuild failed. The roster was updated — fix the error and re-run\n' +
      '  node tools/build-consoles.js');
}

console.log(`
  Hand them this file:
    TeamDashboards/${file}

  It is self-contained — email it, drop it on their desktop, or copy it to a
  USB stick. Nothing else needs to travel with it.

  Still to do for a new ${role} — see ONBOARDING.md:
    - Supabase profile + role
    - GoHighLevel user (if they touch the pipeline)
    - Slack, ClickUp, OpenPhone as needed
`);
