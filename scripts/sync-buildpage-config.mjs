#!/usr/bin/env node
/**
 * sync-buildpage-config.mjs
 * -----------------------------------------------------------------------------
 * Keeps the build page 1:1 with aixmos.config.json by injecting it into
 * index.html as an embedded JSON block the page parses at runtime. One source
 * of truth, no drift.
 *
 *   node sync-buildpage-config.mjs            # write/refresh the block
 *   node sync-buildpage-config.mjs --check    # CI / pre-commit: exit 1 if stale
 *   node sync-buildpage-config.mjs --dir ./web/build-page   # custom location
 *
 * Pairs with the page-side loader (see APPLY_BUILDPAGE.md) that reads
 * #aixmos-config and falls back to the embedded defaults if absent.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dirArg = (() => {
  const i = args.indexOf('--dir');
  return i > -1 ? args[i + 1] : null;
})();
const root = path.resolve(dirArg || process.cwd());
const cfgPath = path.join(root, 'aixmos.config.json');
const htmlPath = path.join(root, 'index.html');

const START = '<!-- AIXMOS_CONFIG_START -->';
const END = '<!-- AIXMOS_CONFIG_END -->';

function fail(msg) {
  console.error('sync-buildpage-config: ' + msg);
  process.exit(1);
}
if (!fs.existsSync(cfgPath)) fail('aixmos.config.json not found in ' + root);
if (!fs.existsSync(htmlPath)) fail('index.html not found in ' + root);

// validate JSON before touching the page
let cfgRaw = fs.readFileSync(cfgPath, 'utf8').trim();
try {
  JSON.parse(cfgRaw);
} catch (e) {
  fail('aixmos.config.json is not valid JSON: ' + e.message);
}
// guard: embedded text must never close the script tag
const safeCfg = cfgRaw.replace(/<\/script/gi, '<\\/script');

const block =
  START +
  '\n<script type="application/json" id="aixmos-config">\n' +
  safeCfg +
  '\n</script>\n' +
  END;

const html = fs.readFileSync(htmlPath, 'utf8');
const re = new RegExp(START + '[\\s\\S]*?' + END);
let next;
if (re.test(html)) next = html.replace(re, block);
else if (html.includes('</body>')) next = html.replace('</body>', block + '\n</body>');
else fail('could not find config markers or </body> in index.html');

if (args.includes('--check')) {
  if (next !== html) fail('DRIFT — index.html config block is stale. Run without --check to fix.');
  console.log('build-page config in sync \u2713');
  process.exit(0);
}

if (next === html) {
  console.log('build-page config already in sync \u2713');
} else {
  fs.writeFileSync(htmlPath, next);
  console.log('Synced aixmos.config.json \u2192 index.html embedded block.');
}
