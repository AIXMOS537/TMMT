/* AIXMOS Command Center — build-consoles.js
 *
 *   node tools/build-consoles.js
 *
 * Generates one SELF-CONTAINED console per entry in tools/profiles.json.
 *
 * Why self-contained: staff consoles are handed out on a USB stick, over email,
 * or dropped on a desktop. They cannot rely on os/ and brand/ sitting next to
 * them. So the kernel, the command engine and the stylesheet are inlined.
 *
 * Why generated: the tile catalog used to be copy-pasted into every file, so a
 * link change meant editing sixteen files and the palettes drifted apart. Now
 * Dashboard-Template.html is the only source, and this script stamps it out.
 *
 * To change a link for everyone: edit Dashboard-Template.html, re-run this.
 * To add a person: add them to tools/profiles.json, re-run this.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'TeamDashboards');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* Normalise line endings before matching. A Windows editor saving CRLF into the
   template would otherwise make every include pattern miss, and the build would
   fail with "the template has drifted" when nothing had actually changed. */
const template = read('Dashboard-Template.html').replace(/\r\n/g, '\n');
const kernel = read('os/kernel.js');
const engine = read('os/command-engine.js');
const theme = read('os/theme.js');
const css = read('brand/console.css');
const profiles = JSON.parse(read('tools/profiles.json'));

/* Inlined code sits inside <script>/<style>. A literal "</script>" anywhere in
   it — including inside a comment, which is exactly where kernel.js documents
   its own include tag — closes the tag early and truncates the file. The HTML
   parser does not care that it is commented out. Escape the slash: harmless in
   JS and CSS, invisible to the parser. */
function guard(code, label) {
  const escaped = code.replace(/<\/(script|style)/gi, '<\\/$1');
  if (escaped !== code) {
    console.log(`  (escaped a closing tag inside ${label})`);
  }
  return escaped;
}

/* Replace, then assert the text actually changed. Do NOT scan the result for
   the old src="..." string: the inlined kernel documents its own include tag in
   a header comment, so that substring is legitimately still present after. */
function swap(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) {
    throw new Error(`${label}: nothing matched — Dashboard-Template.html has drifted`);
  }
  return next;
}

function inline(html) {
  let out = html;

  out = swap(
    out,
    /  <!-- Kernel first[\s\S]*?-->\n  <script src="os\/kernel\.js"><\/script>/,
    [
      '  <!-- INLINED from os/kernel.js — do not edit here.',
      '       Regenerate with: node tools/build-consoles.js -->',
      '  <script>',
      guard(kernel, 'kernel.js'),
      '  </script>'
    ].join('\n'),
    'kernel include'
  );

  out = swap(
    out,
    /  <script src="os\/theme\.js"><\/script>/,
    [
      '  <!-- INLINED from os/theme.js — do not edit here. -->',
      '  <script>',
      guard(theme, 'theme.js'),
      '  </script>'
    ].join('\n'),
    'theme include'
  );

  out = swap(
    out,
    /  <link rel="stylesheet" href="brand\/console\.css" \/>/,
    [
      '  <!-- INLINED from brand/console.css — do not edit here. -->',
      '  <style>',
      guard(css, 'console.css'),
      '  </style>'
    ].join('\n'),
    'stylesheet link'
  );

  out = swap(
    out,
    /  <script src="os\/command-engine\.js"><\/script>/,
    [
      '  <!-- INLINED from os/command-engine.js — do not edit here. -->',
      '  <script>',
      guard(engine, 'command-engine.js'),
      '  </script>'
    ].join('\n'),
    'engine include'
  );

  /* A handout has no sibling Prompt-Library.html, and the Cursor tile deep-links
     into the owner's own machine. Neither belongs on someone else's laptop.
     Both are owner-only (roles: []) so no staff role would render them anyway —
     this just keeps them out of the file entirely. */
  out = out.replace(/^.*label:"Cursor IDE".*\r?\n/m, '');
  out = out.replace(/^.*Prompt-Library\.html.*\r?\n/m, '');

  return out;
}

function profileBlock(p) {
  const extras = (p.extraTiles || []).map((t) => '      ' + t + ',');
  return [
    '  var PROFILE = {',
    `    name: ${JSON.stringify(p.name || 'there')},`,
    `    role: ${JSON.stringify((p.role || 'operator').toLowerCase())},`,
    `    subtitle: ${JSON.stringify(p.subtitle || 'AIXMOS · TMMT')},`,
    `    accent: ${JSON.stringify(p.accent || '')},`,
    '    extraTiles: ['
  ]
    .concat(extras)
    .concat(['    ]', '  };'])
    .join('\n');
}

const base = inline(template);
const PROFILE_BLOCK = /  var PROFILE = \{[\s\S]*?\n  \};/;
if (!PROFILE_BLOCK.test(base)) {
  throw new Error('PROFILE block not found in Dashboard-Template.html');
}

let written = 0;
for (const p of profiles) {
  if (!p.file) {
    console.warn('skipping profile with no file:', p.name);
    continue;
  }
  let html = base.replace(PROFILE_BLOCK, profileBlock(p));
  html = html.replace(/<title>[^<]*<\/title>/, `<title>Command Center — ${p.name || 'Console'}</title>`);

  fs.writeFileSync(path.join(OUT_DIR, p.file), html, 'utf8');
  written++;
  console.log(`  ${p.file.padEnd(34)} ${p.role}`);
}

/* A blank operator console, always current, always ready to hand to someone who
   starts before their name is on the roster. Regenerated on every build so it
   can never drift from the template the way the old copies did. */
const ONBOARDING_DIR = path.join(OUT_DIR, '_onboarding');
fs.mkdirSync(ONBOARDING_DIR, { recursive: true });

const blank = base
  .replace(PROFILE_BLOCK, profileBlock({
    name: 'there',
    role: 'operator',
    subtitle: 'TMMT · New operator',
    extraTiles: []
  }))
  .replace(/<title>[^<]*<\/title>/, '<title>Command Center — New operator</title>');

fs.writeFileSync(path.join(ONBOARDING_DIR, 'Dashboard-New-Operator.html'), blank, 'utf8');

console.log(
  `\n${written} console(s) written to TeamDashboards/ ` +
  `(self-contained, ~${Math.round(base.length / 1024)} KB each).` +
  `\nBlank operator console refreshed at TeamDashboards/_onboarding/.`
);
