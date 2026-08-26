/* AIXMOS Command Center — theme.js
   The colour law, in one place.

   Load after kernel.js, before the page's render script:
     <script src="os/theme.js"></script>

   Each role carries its own accent. That accent drives the primary action, the
   mic, and the focus ring on that person's console. This is the original
   Command Center scheme, restored 2026-08-26.

   The accent is a single hex. Everything derived from it — borders, fills,
   glows — is computed here into literal rgba custom properties, NOT with
   color-mix(). color-mix() is unsupported on Safari 16.x and Chromium <111,
   which are still real machines in this fleet, and a per-role accent means we
   cannot pre-write the literals into the stylesheet.

   ES5 only, same as the rest of os/.
*/
(function () {
  'use strict';

  var W = window;
  var D = document;
  var ROOT = D.documentElement;
  var NS = (W.AIXOS = W.AIXOS || {});
  if (NS.theme) { return; }

  /* The one copy. This used to be pasted into every console, which is how the
     palettes drifted apart in the first place. */
  var ROLE_ACCENT = {
    owner: '#4f8cff',
    manager: '#b794ff',
    dispatch: '#4f8cff',
    operator: '#3ddc97',
    sales: '#ffc24b',
    family: '#ff8fab',
    friend: '#5ad1e6',
    vendor: '#ffa94d'
  };
  var FALLBACK = ROLE_ACCENT.operator;

  function parseHex(hex) {
    var s = String(hex || '').trim().replace(/^#/, '');
    if (s.length === 3) { s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2]; }
    if (!/^[0-9a-fA-F]{6}$/.test(s)) { return null; }
    return [
      parseInt(s.slice(0, 2), 16),
      parseInt(s.slice(2, 4), 16),
      parseInt(s.slice(4, 6), 16)
    ];
  }

  function rgba(rgb, alpha) {
    return 'rgba(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ', ' + alpha + ')';
  }

  /* Lighten toward white for the "soft" companion, so a dark accent still has
     a readable hover/label variant. */
  function lighten(rgb, amount) {
    function up(c) { return Math.round(c + (255 - c) * amount); }
    return '#' + [up(rgb[0]), up(rgb[1]), up(rgb[2])].map(function (c) {
      var h = c.toString(16);
      return h.length === 1 ? '0' + h : h;
    }).join('');
  }

  function accentFor(role, override) {
    var hex = override || ROLE_ACCENT[String(role || '').toLowerCase()] || FALLBACK;
    return parseHex(hex) ? hex : FALLBACK;
  }

  function apply(role, override) {
    var hex = accentFor(role, override);
    var rgb = parseHex(hex) || parseHex(FALLBACK);
    var style = ROOT.style;

    style.setProperty('--accent', hex);
    style.setProperty('--accent-soft', lighten(rgb, 0.35));
    style.setProperty('--accent-line', rgba(rgb, 0.45));
    style.setProperty('--accent-line-soft', rgba(rgb, 0.28));
    style.setProperty('--accent-fill', rgba(rgb, 0.16));
    style.setProperty('--accent-fill-strong', rgba(rgb, 0.3));
    style.setProperty('--accent-glow', rgba(rgb, 0.32));

    ROOT.setAttribute('data-role', String(role || '').toLowerCase());
    return hex;
  }

  NS.theme = {
    roles: ROLE_ACCENT,
    accentFor: accentFor,
    apply: apply
  };
})();
