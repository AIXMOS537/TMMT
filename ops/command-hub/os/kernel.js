/* AIXMOS Command Center - kernel.js
   Phase 1 - Foundation. Hardware capability detection + effect tiering.

   Load SYNCHRONOUSLY in <head>, before any stylesheet that reads the tier:
     <script src="os/kernel.js"></script>

   It stamps <html> with:
     data-tier       lite | standard | full
     data-effects    space-separated: motion grid blur glow shadow
     data-gpu        nvidia | amd | intel | apple | adreno | mali | powervr | software | unknown
     data-gpu-class  discrete | integrated | mobile | software | unknown
     data-platform   windows | macos | ios | ipados | android | linux | unknown

   Rules of the house:
   - No frameworks. ES5 only. Must run on a 2013 shop PC and on an M-series Mac.
   - Never block first paint on a GPU probe. Cheap signals decide the first tier;
     the GPU probe refines it on idle and is cached per machine.
   - The owner can always pin a tier by hand; a pin outranks every heuristic.
*/
(function () {
  'use strict';

  var W = window;
  var D = document;
  var ROOT = D.documentElement;
  var NS = (W.AIXOS = W.AIXOS || {});
  if (NS.kernel) { return; }

  var CACHE_KEY = 'aixos.kernel.gpu.v1';
  var PIN_KEY = 'aixos.kernel.tier.pin';
  var TIERS = ['lite', 'standard', 'full'];

  /* ---------- tiny helpers (no deps, never throw) ---------- */
  function store(key, value) {
    try {
      if (arguments.length === 1) { return W.localStorage.getItem(key); }
      if (value === null) { W.localStorage.removeItem(key); return null; }
      W.localStorage.setItem(key, value);
      return value;
    } catch (e) { return null; }
  }
  function mq(query) {
    try { return W.matchMedia ? W.matchMedia(query) : null; } catch (e) { return null; }
  }
  function mqOn(query) {
    var m = mq(query);
    return !!(m && m.matches);
  }
  function finiteNum(value, fallback) {
    return (typeof value === 'number' && isFinite(value) && value > 0) ? value : fallback;
  }

  /* ---------- 1. cheap signals (safe before first paint) ---------- */
  var ua = navigator.userAgent || '';
  var uaData = navigator.userAgentData || null;
  var cores = finiteNum(navigator.hardwareConcurrency, 0);
  var memory = finiteNum(navigator.deviceMemory, 0); /* GiB, Chromium only */
  var touchPoints = finiteNum(navigator.maxTouchPoints, 0);
  var dpr = finiteNum(W.devicePixelRatio, 1);

  function detectPlatform() {
    var hint = (uaData && uaData.platform) || navigator.platform || '';
    var s = (hint + ' ' + ua).toLowerCase();
    if (/iphone|ipod/.test(s)) { return 'ios'; }
    if (/ipad/.test(s)) { return 'ipados'; }
    if (/android/.test(s)) { return 'android'; }
    if (/mac/.test(s)) {
      /* iPadOS masquerades as desktop Safari; only it reports real touch on a "Mac". */
      return touchPoints > 2 ? 'ipados' : 'macos';
    }
    if (/win/.test(s)) { return 'windows'; }
    if (/cros|linux|x11|freebsd/.test(s)) { return 'linux'; }
    return 'unknown';
  }
  var platform = detectPlatform();
  var isApple = platform === 'macos' || platform === 'ios' || platform === 'ipados';

  function connection() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) { return { saveData: false, effectiveType: '' }; }
    return { saveData: !!c.saveData, effectiveType: String(c.effectiveType || '') };
  }

  /* ---------- 2. GPU probe (cached; runs once per machine) ---------- */
  var GPU_PATTERNS = [
    ['nvidia',   /nvidia|geforce|quadro|\brtx\b|\bgtx\b|tegra/],
    ['apple',    /apple\s*m\d|apple\s*a\d|apple gpu|apple paravirtual/],
    ['amd',      /\bamd\b|radeon|\brx\s*\d|vega|firepro|\bati\b|navi/],
    ['intel',    /intel|hd graphics|uhd graphics|iris|\barc\s*a\d/],
    ['adreno',   /adreno/],
    ['mali',     /mali/],
    ['powervr',  /powervr|sgx/]
  ];
  var SOFTWARE_RE = /swiftshader|llvmpipe|softpipe|microsoft basic|basic render|virgl|software adapter/;

  function classifyGpu(renderer) {
    var s = String(renderer || '').toLowerCase();
    if (!s) { return { vendor: 'unknown', klass: 'unknown', renderer: '' }; }

    var vendor = 'unknown';
    for (var i = 0; i < GPU_PATTERNS.length; i++) {
      if (GPU_PATTERNS[i][1].test(s)) { vendor = GPU_PATTERNS[i][0]; break; }
    }
    /* Software rasterisers often still name a vendor ("Intel, SwiftShader"). They win. */
    if (SOFTWARE_RE.test(s)) { vendor = 'software'; }

    var klass;
    if (vendor === 'software') {
      klass = 'software';
    } else if (vendor === 'adreno' || vendor === 'mali' || vendor === 'powervr') {
      klass = 'mobile';
    } else if (vendor === 'apple') {
      /* Apple silicon is integrated but outruns most discrete parts for this workload. */
      klass = 'integrated';
    } else if (vendor === 'nvidia') {
      klass = 'discrete';
    } else if (vendor === 'amd') {
      klass = (/vega\s*\d|radeon\s*graphics|\bapu\b|ryzen/.test(s) && !/\brx\s*\d|radeon pro|navi/.test(s))
        ? 'integrated' : 'discrete';
    } else if (vendor === 'intel') {
      klass = /\barc\s*a\d/.test(s) ? 'discrete' : 'integrated';
    } else {
      klass = 'unknown';
    }
    return { vendor: vendor, klass: klass, renderer: String(renderer) };
  }

  function probeGpu() {
    var canvas, gl = null, info, renderer = '';
    try {
      canvas = D.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      var opts = {
        failIfMajorPerformanceCaveat: false, powerPreference: 'low-power',
        antialias: false, depth: false, stencil: false
      };
      gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts) ||
           canvas.getContext('experimental-webgl', opts);
      if (!gl) { return { vendor: 'software', klass: 'software', renderer: 'no-webgl' }; }
      info = gl.getExtension('WEBGL_debug_renderer_info');
      if (info) { renderer = gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || ''; }
      if (!renderer) { renderer = gl.getParameter(gl.RENDERER) || ''; }
    } catch (e) {
      return { vendor: 'unknown', klass: 'unknown', renderer: '' };
    } finally {
      /* Release immediately - a held GL context costs real memory on a 4 GB box. */
      try {
        var lose = gl && gl.getExtension('WEBGL_lose_context');
        if (lose) { lose.loseContext(); }
      } catch (e2) {}
    }
    return classifyGpu(renderer);
  }

  function cachedGpu() {
    var raw = store(CACHE_KEY);
    if (!raw) { return null; }
    try {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.ua === ua && parsed.gpu) { return parsed.gpu; }
    } catch (e) {}
    return null;
  }
  function cacheGpu(gpu) {
    try { store(CACHE_KEY, JSON.stringify({ ua: ua, gpu: gpu })); } catch (e) {}
  }

  /* ---------- 3. scoring ---------- */
  var OLD_INTEL_RE = /hd graphics (2000|3000|4000|4400|4600|5000|5500|520)/;

  function scoreOf(gpu) {
    var conn = connection();
    var score = 0;

    if (cores >= 8) { score += 2; }
    else if (cores >= 4) { score += 1; }
    else if (cores > 0) { score -= 1; }

    if (memory >= 8) { score += 2; }
    else if (memory >= 4) { score += 1; }
    else if (memory > 0 && memory <= 2) { score -= 2; }

    /* Safari and Firefox never report deviceMemory. Absence is not weakness. */
    if (!memory && isApple) { score += 1; }

    switch (gpu && gpu.klass) {
      case 'discrete': score += 2; break;
      case 'integrated': score += (gpu.vendor === 'apple') ? 2 : 1; break;
      case 'mobile': break;
      case 'software': score -= 5; break;
      default: break;
    }
    /* Pre-Skylake Intel iGPUs stall on backdrop-filter at any window size. */
    if (gpu && gpu.vendor === 'intel' && OLD_INTEL_RE.test(String(gpu.renderer).toLowerCase())) {
      score -= 2;
    }
    /* Pushing many pixels through a weak GPU is the classic shop-PC stall. */
    try {
      var pixels = (screen.width || 0) * (screen.height || 0) * dpr * dpr;
      if (pixels > 4000000 && score < 4) { score -= 1; }
    } catch (e) {}

    if (conn.saveData) { score -= 3; }
    if (/^(slow-2g|2g)$/.test(conn.effectiveType)) { score -= 2; }
    if (mqOn('(update: slow)')) { score -= 3; }
    if (mqOn('(forced-colors: active)')) { score -= 5; }

    return score;
  }

  function tierFromScore(score, gpu) {
    var tier = score >= 4 ? 'full' : (score >= 1 ? 'standard' : 'lite');

    /* Ceiling, not a score adjustment: a non-Apple integrated GPU does not get
       backdrop-filter just because the box has plenty of RAM. An Iris 540 with
       16 GB scores well and still drops frames compositing glass. Let it earn
       'full' only with a modern core count and memory behind it. */
    if (tier === 'full' && gpu && gpu.klass === 'integrated' && gpu.vendor !== 'apple') {
      if (!(cores >= 8 && memory >= 8)) { tier = 'standard'; }
    }
    if (gpu && (gpu.klass === 'software' || gpu.klass === 'mobile') && tier === 'full') {
      tier = 'standard';
    }
    return tier;
  }

  /* ---------- 4. effect budget ---------- */
  function effectsFor(tier) {
    var reduceMotion = mqOn('(prefers-reduced-motion: reduce)');
    var reduceTransparency = mqOn('(prefers-reduced-transparency: reduce)');
    var forced = mqOn('(forced-colors: active)');
    var out = [];

    if (!reduceMotion && tier !== 'lite') { out.push('motion'); }
    if (tier !== 'lite' && !forced) { out.push('grid'); }
    if (tier !== 'lite' && !forced) { out.push('shadow'); }
    if (tier === 'full' && !reduceTransparency && !forced) { out.push('blur'); }
    if (tier === 'full' && !forced) { out.push('glow'); }
    return out;
  }

  /* ---------- 5. apply ---------- */
  var state = {
    tier: 'standard',
    pinned: null,
    effects: [],
    gpu: { vendor: 'unknown', klass: 'unknown', renderer: '' },
    platform: platform,
    cores: cores,
    memory: memory,
    dpr: dpr,
    score: 0,
    fps: 0,
    demotions: 0,
    source: 'boot'
  };
  var listeners = [];

  function snapshot() {
    return {
      tier: state.tier, pinned: state.pinned, effects: state.effects.slice(),
      gpu: state.gpu.vendor, gpuClass: state.gpu.klass, renderer: state.gpu.renderer,
      platform: state.platform, cores: state.cores, memory: state.memory,
      dpr: state.dpr, score: state.score, fps: state.fps, source: state.source
    };
  }
  function emit() {
    var snap = snapshot();
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](snap); } catch (e) {}
    }
  }

  function apply(tier, source) {
    var effective = state.pinned || tier;
    var changed = effective !== state.tier;
    state.tier = effective;
    state.effects = effectsFor(effective);
    state.source = source || state.source;

    ROOT.setAttribute('data-tier', effective);
    ROOT.setAttribute('data-effects', state.effects.join(' '));
    ROOT.setAttribute('data-platform', state.platform);
    ROOT.setAttribute('data-gpu', state.gpu.vendor);
    ROOT.setAttribute('data-gpu-class', state.gpu.klass);
    if (changed) { emit(); }
    return effective;
  }

  state.pinned = (function () {
    var pin = store(PIN_KEY);
    return (pin && TIERS.indexOf(pin) !== -1) ? pin : null;
  })();

  /* First paint decides on cheap signals only. A cached GPU verdict counts as cheap. */
  var cached = cachedGpu();
  if (cached) { state.gpu = cached; }
  state.score = scoreOf(state.gpu);
  apply(tierFromScore(state.score, state.gpu), cached ? "cache" : "provisional");

  /* ---------- 6. refine off the critical path ---------- */
  function idle(fn) {
    if (W.requestIdleCallback) { W.requestIdleCallback(fn, { timeout: 2000 }); }
    else { setTimeout(fn, 250); }
  }

  if (!cached) {
    idle(function () {
      var gpu = probeGpu();
      state.gpu = gpu;
      cacheGpu(gpu);
      state.score = scoreOf(gpu);
      apply(tierFromScore(state.score, state.gpu), 'probe');
    });
  }

  /* ---------- 7. measured reality beats every heuristic ---------- */
  function demote(reason) {
    if (state.pinned) { return; }
    var i = TIERS.indexOf(state.tier);
    if (i <= 0) { return; }
    state.demotions++;
    apply(TIERS[i - 1], reason || 'measured');
  }

  function measureFrames(sampleFrames, done) {
    if (!W.requestAnimationFrame) { done(0); return; }
    var frames = 0, start = 0;
    function step(now) {
      if (!start) { start = now; }
      frames++;
      if (frames < sampleFrames) { W.requestAnimationFrame(step); return; }
      var elapsed = now - start;
      done(elapsed > 0 ? Math.round((frames - 1) * 1000 / elapsed) : 0);
    }
    W.requestAnimationFrame(step);
  }

  function watchFrames() {
    if (state.pinned || D.hidden) { return; }
    measureFrames(45, function (fps) {
      state.fps = fps;
      /* 0 means we could not measure - never punish a machine for that. */
      if (fps > 0 && fps < 42) { demote('slow-frames'); }
      emit();
    });
  }

  function onReady(fn) {
    if (D.readyState === 'complete' || D.readyState === 'interactive') { setTimeout(fn, 0); }
    else { D.addEventListener('DOMContentLoaded', fn); }
  }
  onReady(function () { setTimeout(watchFrames, 900); });

  /* Re-evaluate the budget when an accessibility preference changes mid-session. */
  var PREF_QUERIES = [
    '(prefers-reduced-motion: reduce)',
    '(prefers-reduced-transparency: reduce)',
    '(forced-colors: active)'
  ];
  for (var q = 0; q < PREF_QUERIES.length; q++) {
    (function (query) {
      var m = mq(query);
      if (!m) { return; }
      var handler = function () { apply(state.tier, 'preference'); emit(); };
      if (m.addEventListener) { m.addEventListener('change', handler); }
      else if (m.addListener) { m.addListener(handler); }
    })(PREF_QUERIES[q]);
  }

  /* ---------- 8. public surface ---------- */
  NS.kernel = {
    version: 1,
    tiers: TIERS.slice(),
    get: snapshot,
    has: function (effect) { return state.effects.indexOf(effect) !== -1; },
    pin: function (tier) {
      if (tier === null || tier === 'auto') {
        state.pinned = null;
        store(PIN_KEY, null);
        state.score = scoreOf(state.gpu);
        return apply(tierFromScore(state.score, state.gpu), 'auto');
      }
      if (TIERS.indexOf(tier) === -1) { return state.tier; }
      state.pinned = tier;
      store(PIN_KEY, tier);
      return apply(tier, 'pinned');
    },
    cycle: function () {
      var order = ['auto'].concat(TIERS);
      var current = state.pinned || 'auto';
      return NS.kernel.pin(order[(order.indexOf(current) + 1) % order.length]);
    },
    remeasure: watchFrames,
    on: function (fn) { if (typeof fn === 'function') { listeners.push(fn); fn(snapshot()); } },
    describe: function () {
      var s = snapshot();
      var bits = [s.gpu === 'unknown' ? 'GPU unknown' : s.gpu.toUpperCase()];
      if (s.cores) { bits.push(s.cores + ' cores'); }
      if (s.memory) { bits.push(s.memory + ' GB'); }
      bits.push(s.tier + (s.pinned ? ' (pinned)' : '') + ' graphics');
      return bits.join(' · ');
    }
  };
})();
