/* AIXMOS Command Center - command-engine.js
   Phase 2 - Brain. One command engine behind voice, keyboard and mouse.

   Load AFTER kernel.js, at the end of <body>:
     <script src="os/command-engine.js"></script>

   Laws (from the NEXUS brief - do not relitigate these in a later pass):
   - Voice is the primary input. The palette and the mouse are fallbacks, never absent.
   - The engine is a STATE MACHINE, not a regex that opens a URL:
       idle | listening | thinking | acting | speaking | error | offline
   - Unknown input returns the verb list. It never dumps the user into a web search.
     A web search is its own verb, spoken on purpose: "search <thing>".
   - Speaking is interruptible. New input stops the voice immediately.
   - No shell, no shutdown, no delete. Voice cannot reach the machine.
*/
(function () {
  'use strict';

  var W = window;
  var D = document;
  var ROOT = D.documentElement;
  var NS = (W.AIXOS = W.AIXOS || {});
  if (NS.os) { return; }

  var STATES = ['idle', 'listening', 'thinking', 'acting', 'speaking', 'error', 'offline'];
  var WAKE_WORDS = ['nexus', 'hey nexus', 'okay nexus', 'ok nexus', 'command', 'hey command', 'okay command', 'computer'];
  var QUESTION_RE = /^(what|when|where|why|who|how|which|is|are|can|could|should|do|does|did|will|would|tell me|show me)\b/;
  /* Voice must never be able to touch the machine. Refuse, loudly, before matching. */
  var FORBIDDEN_RE = /\b(shutdown|shut down|reboot|restart the (pc|computer|machine)|format|wipe|erase|uninstall|delete (all|everything|the)|rm -rf|kill process|disable (defender|firewall|antivirus))\b/;

  var config = {
    assistantUrl: '',
    allowAssistant: false,
    searchUrl: 'https://www.google.com/search?q=',
    speak: true,
    statusEl: null,
    stateEl: null,
    micEl: null,
    micLabelEl: null,
    handsFreeEl: null
  };

  var targets = [];
  var commands = [];
  var listeners = [];
  var state = 'idle';
  var lastMessage = '';

  /* ---------------- state machine ---------------- */
  function setState(next, message) {
    if (STATES.indexOf(next) === -1) { next = 'idle'; }
    state = next;
    lastMessage = message || '';
    ROOT.setAttribute('data-os-state', state);

    if (config.statusEl) {
      config.statusEl.textContent = lastMessage;
      config.statusEl.className = 'os-status ' + state;
    }
    if (config.stateEl) {
      config.stateEl.textContent = state;
    }
    if (config.micEl) {
      config.micEl.classList.toggle('listening', state === 'listening');
      config.micEl.setAttribute('aria-pressed', state === 'listening' ? 'true' : 'false');
    }
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](state, lastMessage); } catch (e) {}
    }
  }
  function idleSoon(message, delay) {
    W.setTimeout(function () {
      if (state !== 'listening') { setState(navigator.onLine === false ? 'offline' : 'idle', message || ''); }
    }, delay || 2600);
  }

  /* ---------------- speech out (interruptible) ---------------- */
  var synth = W.speechSynthesis || null;
  function stopSpeaking() {
    if (synth) { try { synth.cancel(); } catch (e) {} }
  }
  function say(text) {
    if (!config.speak || !synth || !text) { return; }
    try {
      stopSpeaking();
      var utter = new W.SpeechSynthesisUtterance(String(text));
      utter.rate = 1.02;
      utter.onend = function () { if (state === 'speaking') { setState('idle', ''); } };
      setState('speaking', text);
      synth.speak(utter);
    } catch (e) {}
  }

  /* ---------------- registry ---------------- */
  function normalise(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function registerTarget(t) {
    if (!t || !t.name) { return; }
    var keywords = [];
    var words = normalise(t.name).split(' ');
    for (var i = 0; i < words.length; i++) { if (words[i].length > 1) { keywords.push(words[i]); } }
    if (t.keywords) {
      var extra = (typeof t.keywords === 'string') ? t.keywords.split(',') : t.keywords;
      for (var j = 0; j < extra.length; j++) {
        var k = normalise(extra[j]);
        if (k) { keywords.push(k); }
      }
    }
    targets.push({
      kind: 'target',
      id: t.id || ('target-' + targets.length),
      name: t.name,
      label: t.label || t.name,
      hint: String(t.hint || '').replace(/\s+/g, ' ').trim().slice(0, 64),
      keywords: keywords,
      open: t.open || null,
      href: t.href || '',
      external: t.external !== false
    });
  }

  function registerCommand(c) {
    if (!c || !c.verb || typeof c.run !== 'function') { return; }
    commands.push({
      kind: 'command',
      id: c.id || c.verb,
      verb: c.verb,
      phrases: (c.phrases || [c.verb]).map(normalise),
      help: c.help || '',
      args: !!c.args,
      run: c.run
    });
  }

  function verbList() {
    var out = [];
    for (var i = 0; i < commands.length; i++) { out.push(commands[i].verb); }
    return out;
  }

  /* ---------------- matching ---------------- */
  function matchCommand(said) {
    for (var i = 0; i < commands.length; i++) {
      var c = commands[i];
      for (var p = 0; p < c.phrases.length; p++) {
        var phrase = c.phrases[p];
        if (!phrase) { continue; }
        if (said === phrase) { return { cmd: c, rest: '' }; }
        if (said.indexOf(phrase + ' ') === 0) { return { cmd: c, rest: said.slice(phrase.length).trim() }; }
      }
    }
    return null;
  }

  function matchTarget(said) {
    if (!said) { return null; }
    var i, t;
    for (i = 0; i < targets.length; i++) {
      t = targets[i];
      var name = normalise(t.name);
      if (said === name || said.indexOf(name) !== -1 || (name.length > 3 && name.indexOf(said) !== -1)) { return t; }
    }
    var spoken = said.split(' ');
    var best = null, bestScore = 0;
    for (i = 0; i < targets.length; i++) {
      t = targets[i];
      var score = 0;
      for (var k = 0; k < t.keywords.length; k++) {
        for (var w = 0; w < spoken.length; w++) {
          var word = spoken[w];
          if (word.length < 3) { continue; }
          if (word === t.keywords[k]) { score += 2; }
          else if (t.keywords[k].indexOf(word) !== -1 || word.indexOf(t.keywords[k]) !== -1) { score += 1; }
        }
      }
      if (score > bestScore) { bestScore = score; best = t; }
    }
    /* One weak keyword hit is a coincidence, not an intent. */
    return bestScore >= 2 ? best : null;
  }

  function openTarget(t) {
    setState('acting', 'Opening ' + t.label);
    try {
      if (typeof t.open === 'function') { t.open(); }
      else if (t.href) {
        if (t.external) { W.open(t.href, '_blank', 'noopener'); }
        else { W.location.href = t.href; }
      }
    } catch (e) {
      setState('error', 'Could not open ' + t.label);
      return;
    }
    idleSoon('');
  }

  function stripWake(said) {
    for (var i = 0; i < WAKE_WORDS.length; i++) {
      var w = WAKE_WORDS[i];
      if (said === w) { return ''; }
      if (said.indexOf(w + ' ') === 0) { return said.slice(w.length).trim(); }
    }
    return null; /* null = no wake word present */
  }

  /* ---------------- the one entry point ---------------- */
  function run(raw, source) {
    stopSpeaking();
    var said = normalise(raw);
    if (!said) { setState('idle', ''); return; }

    if (FORBIDDEN_RE.test(said)) {
      setState('error', 'Refused. This console cannot control the machine.');
      idleSoon('', 4000);
      return;
    }

    setState('thinking', 'Heard "' + said + '"');

    var stripped = stripWake(said);
    if (stripped !== null) {
      if (!stripped) { setState('listening', 'Yes? Name a page or a verb.'); return; }
      said = stripped;
    }

    var hit = matchCommand(said);
    if (hit) {
      try { hit.cmd.run(hit.rest, { source: source || 'text', said: said }); }
      catch (e) { setState('error', 'That command failed.'); idleSoon(''); }
      return;
    }

    var t = matchTarget(said);
    if (t) { openTarget(t); return; }

    if (QUESTION_RE.test(said) && config.allowAssistant && config.assistantUrl) {
      askAssistant(said);
      return;
    }

    /* The NEXUS rule: unknown input returns the verb list, not a web dump. */
    setState('error', 'Not a known command. Try: ' + verbList().slice(0, 6).join(', ') + ' - or press Ctrl+K.');
    idleSoon('', 5200);
  }

  function askAssistant(question) {
    if (!config.assistantUrl) {
      setState('error', 'No assistant is configured on this profile.');
      idleSoon('');
      return;
    }
    setState('acting', 'Asking the Assistant: "' + question + '"');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(question).catch(function () {});
      }
    } catch (e) {}
    W.open(config.assistantUrl + (config.assistantUrl.indexOf('?') === -1 ? '?q=' : '&q=') + encodeURIComponent(question), '_blank', 'noopener');
    idleSoon('');
  }

  /* ---------------- built-in verbs ---------------- */
  function installBuiltins() {
    registerCommand({
      verb: 'help', phrases: ['help', 'what can you do', 'commands', 'verbs'],
      help: 'list every verb this console knows',
      run: function () {
        var msg = 'Verbs: ' + verbList().join(', ') + '. Or say a tile name.';
        setState('acting', msg);
        say('I know ' + verbList().length + ' verbs. ' + verbList().slice(0, 6).join(', '));
        idleSoon('', 7000);
      }
    });
    registerCommand({
      verb: 'open', phrases: ['open', 'go to', 'launch', 'show me', 'show'], args: true,
      help: 'open a tile by name',
      run: function (rest) {
        var t = matchTarget(normalise(rest));
        if (t) { openTarget(t); return; }
        setState('error', 'No tile called "' + rest + '". Press Ctrl+K to see them all.');
        idleSoon('', 4200);
      }
    });
    registerCommand({
      verb: 'search', phrases: ['search', 'search the web', 'look up', 'google'], args: true,
      help: 'search the web on purpose',
      run: function (rest) {
        if (!rest) { setState('error', 'Say what to search for.'); idleSoon(''); return; }
        setState('acting', 'Searching the web for "' + rest + '"');
        W.open(config.searchUrl + encodeURIComponent(rest), '_blank', 'noopener');
        idleSoon('');
      }
    });
    registerCommand({
      verb: 'ask', phrases: ['ask', 'ask the assistant', 'assistant', 'question'], args: true,
      help: 'send a question to the TMMT Assistant',
      run: function (rest) {
        if (!config.allowAssistant) { setState('error', 'The Assistant is not available on this profile.'); idleSoon(''); return; }
        if (!rest) { setState('error', 'Say the question after "ask".'); idleSoon(''); return; }
        askAssistant(rest);
      }
    });
    registerCommand({
      verb: 'graphics', phrases: ['graphics', 'performance', 'graphics mode', 'set graphics'], args: true,
      help: 'pin graphics: auto | lite | standard | full',
      run: function (rest) {
        if (!NS.kernel) { setState('error', 'Kernel not loaded.'); idleSoon(''); return; }
        var want = normalise(rest);
        var applied = want ? NS.kernel.pin(want === 'auto' ? 'auto' : want) : NS.kernel.cycle();
        setState('acting', 'Graphics: ' + applied + ' - ' + NS.kernel.describe());
        idleSoon('', 5000);
      }
    });
    registerCommand({
      verb: 'status', phrases: ['status', 'system', 'diagnostics', 'what machine is this'],
      help: 'report the machine this console is running on',
      run: function () {
        var text = NS.kernel ? NS.kernel.describe() : 'Kernel not loaded';
        setState('acting', text);
        say(text);
        idleSoon('', 6000);
      }
    });
    registerCommand({
      verb: 'stop', phrases: ['stop', 'cancel', 'never mind', 'quiet'],
      help: 'stop listening and stop speaking',
      run: function () { stopSpeaking(); voice.stop(); setState('idle', ''); }
    });
  }

  /* ---------------- command palette (keyboard fallback) ---------------- */
  var palette = (function () {
    var wrap = null, input = null, list = null, items = [], active = 0, lastFocus = null;

    function build() {
      wrap = D.createElement('div');
      wrap.className = 'os-palette';
      wrap.setAttribute('hidden', 'hidden');
      wrap.innerHTML =
        '<div class="os-palette-sheet" role="dialog" aria-modal="true" aria-label="Command palette">' +
          '<input class="os-palette-input" type="text" autocomplete="off" spellcheck="false" ' +
                 'placeholder="Type a verb or a page name" aria-label="Command" />' +
          '<ul class="os-palette-list" role="listbox"></ul>' +
          '<p class="os-palette-foot">Enter to run · Esc to close · voice is the primary input</p>' +
        '</div>';
      D.body.appendChild(wrap);
      input = wrap.querySelector('.os-palette-input');
      list = wrap.querySelector('.os-palette-list');

      input.addEventListener('input', function () { render(input.value); });
      input.addEventListener('keydown', onKey);
      wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) { close(); } });
    }

    function pool() {
      var out = [];
      for (var i = 0; i < commands.length; i++) {
        out.push({ kind: 'command', label: commands[i].verb, hint: commands[i].help, ref: commands[i] });
      }
      for (var j = 0; j < targets.length; j++) {
        out.push({ kind: 'target', label: targets[j].label, hint: targets[j].hint, ref: targets[j] });
      }
      return out;
    }

    function render(query) {
      var q = normalise(query);
      var all = pool();
      items = [];
      for (var i = 0; i < all.length; i++) {
        var hay = normalise(all[i].label + ' ' + all[i].hint);
        if (!q || hay.indexOf(q) !== -1) { items.push(all[i]); }
      }
      items = items.slice(0, 40);
      active = 0;
      var html = '';
      for (var k = 0; k < items.length; k++) {
        html += '<li role="option" class="os-palette-item' + (k === 0 ? ' active' : '') + '" data-i="' + k + '">' +
                  '<span class="os-palette-kind">' + (items[k].kind === 'command' ? 'verb' : 'open') + '</span>' +
                  '<span class="os-palette-label"></span>' +
                  '<span class="os-palette-hint"></span>' +
                '</li>';
      }
      list.innerHTML = html || '<li class="os-palette-empty">Nothing matches. Try: ' + verbList().slice(0, 5).join(', ') + '</li>';
      /* textContent, not innerHTML, for anything that came from a profile file. */
      var nodes = list.querySelectorAll('.os-palette-item');
      for (var n = 0; n < nodes.length; n++) {
        nodes[n].querySelector('.os-palette-label').textContent = items[n].label;
        nodes[n].querySelector('.os-palette-hint').textContent = items[n].hint || '';
        nodes[n].addEventListener('click', function (e) {
          choose(parseInt(e.currentTarget.getAttribute('data-i'), 10));
        });
      }
    }

    function move(delta) {
      if (!items.length) { return; }
      var nodes = list.querySelectorAll('.os-palette-item');
      if (nodes[active]) { nodes[active].classList.remove('active'); }
      active = (active + delta + items.length) % items.length;
      if (nodes[active]) {
        nodes[active].classList.add('active');
        if (nodes[active].scrollIntoView) { nodes[active].scrollIntoView({ block: 'nearest' }); }
      }
    }

    function choose(i) {
      var item = items[typeof i === 'number' ? i : active];
      if (!item) { return; }
      close();
      if (item.kind === 'target') { openTarget(item.ref); return; }
      if (item.ref.args) { setState('listening', item.ref.verb + ' what? Type it and press Enter.'); reopenWith(item.ref.verb + ' '); return; }
      run(item.ref.verb, 'palette');
    }

    function reopenWith(prefix) {
      open();
      input.value = prefix;
      render(prefix);
    }

    function onKey(e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        var typed = input.value;
        if (items.length) { choose(); }
        else { close(); run(typed, 'palette'); }
      } else if (e.key === 'Escape') { e.preventDefault(); close(); }
    }

    function open() {
      if (!wrap) { build(); }
      stopSpeaking();
      lastFocus = D.activeElement;
      wrap.removeAttribute('hidden');
      ROOT.setAttribute('data-os-palette', 'open');
      input.value = '';
      render('');
      input.focus();
    }
    function close() {
      if (!wrap) { return; }
      wrap.setAttribute('hidden', 'hidden');
      ROOT.removeAttribute('data-os-palette');
      if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    }
    function isOpen() { return !!wrap && !wrap.hasAttribute('hidden'); }

    return { open: open, close: close, toggle: function () { isOpen() ? close() : open(); }, isOpen: isOpen };
  })();

  /* ---------------- voice ---------------- */
  var voice = (function () {
    var SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    var rec = null, active = false, handsFree = false, supported = !!SR;

    function ensure() {
      if (rec || !supported) { return rec; }
      rec = new SR();
      rec.lang = 'en-US';
      rec.maxAlternatives = 3;

      rec.onstart = function () {
        active = true;
        setState('listening', handsFree ? 'Listening for "Nexus ..."' : 'Speak now');
        if (config.micLabelEl) { config.micLabelEl.textContent = handsFree ? 'Hands-free on' : 'Listening'; }
      };
      rec.onerror = function (e) {
        active = false;
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          handsFree = false; paintHandsFree();
          setState('error', 'Microphone blocked. Allow mic access, or press Ctrl+K.');
        } else if (e.error === 'no-speech' && !handsFree) {
          setState('error', 'Did not catch that. Tap the mic, or press Ctrl+K.');
          idleSoon('');
        }
      };
      rec.onend = function () {
        active = false;
        if (config.micLabelEl) { config.micLabelEl.textContent = handsFree ? 'Hands-free on' : 'Hold to command'; }
        if (handsFree) { try { rec.start(); } catch (e) {} }
        else if (state === 'listening') { setState('idle', ''); }
      };
      rec.onresult = function (e) {
        for (var i = e.resultIndex; i < e.results.length; i++) {
          if (!e.results[i].isFinal) { continue; }
          var alts = e.results[i];
          if (handsFree) {
            for (var a = 0; a < alts.length; a++) {
              var stripped = stripWake(normalise(alts[a].transcript));
              if (stripped !== null) {
                if (stripped) { run(stripped, 'voice'); }
                else { setState('listening', 'Yes? Name a page or a verb.'); }
                return;
              }
            }
            return; /* no wake word - stay asleep, say nothing */
          }
          run(alts[0].transcript, 'voice');
          return;
        }
      };
      return rec;
    }

    function applyMode() {
      var r = ensure();
      if (!r) { return; }
      r.continuous = handsFree;
      r.interimResults = handsFree;
    }
    function paintHandsFree() {
      if (!config.handsFreeEl) { return; }
      config.handsFreeEl.classList.toggle('on', handsFree);
      config.handsFreeEl.textContent = handsFree ? 'Hands-free: on' : 'Hands-free: off';
      config.handsFreeEl.setAttribute('aria-pressed', handsFree ? 'true' : 'false');
    }

    function start() {
      if (!supported) { setState('error', 'Voice needs Edge or Chrome. Press Ctrl+K instead.'); return; }
      stopSpeaking();
      applyMode();
      try { ensure().start(); } catch (e) {}
    }
    function stop() {
      handsFree = false; paintHandsFree();
      if (rec) { try { rec.stop(); } catch (e) {} }
    }
    function toggleHandsFree() {
      if (!supported) { setState('error', 'Voice needs Edge or Chrome. Press Ctrl+K instead.'); return; }
      handsFree = !handsFree;
      paintHandsFree();
      if (handsFree) {
        if (active && rec) { try { rec.stop(); } catch (e) {} }
        applyMode();
        try { ensure().start(); } catch (e) {}
      } else {
        if (rec) { try { rec.stop(); } catch (e) {} }
        setState('idle', 'Hands-free off. Tap the mic or press Ctrl+K.');
      }
    }
    function tap() {
      if (handsFree) { setState('listening', 'Hands-free is on. Say "Nexus ..."'); return; }
      if (active) { stop(); setState('idle', ''); return; }
      start();
    }

    return {
      supported: supported, start: start, stop: stop, tap: tap,
      toggleHandsFree: toggleHandsFree, paint: paintHandsFree,
      isHandsFree: function () { return handsFree; }
    };
  })();

  /* ---------------- wiring ---------------- */
  function indexTiles(selector) {
    var nodes = D.querySelectorAll(selector || 'a.tile');
    for (var i = 0; i < nodes.length; i++) {
      (function (el) {
        /* A card may be a tile (icon + label + .small) or a hero (h3 + p).
           Take the heading when there is one; never let a paragraph of body
           copy become the target's name. */
        var heading = el.querySelector('h2, h3, h4');
        var name;
        if (heading) {
          name = heading.textContent.replace(/\s+/g, ' ').trim();
        } else {
          var clone = el.cloneNode(true);
          var junk = clone.querySelectorAll('.icon, .small');
          for (var j = 0; j < junk.length; j++) { junk[j].parentNode.removeChild(junk[j]); }
          name = clone.textContent.replace(/\s+/g, ' ').trim();
        }
        var subEl = el.querySelector('.small') || (heading ? el.querySelector('p') : null);
        registerTarget({
          name: name,
          label: name,
          hint: subEl ? subEl.textContent.trim() : '',
          keywords: el.getAttribute('data-say') || '',
          href: el.getAttribute('href') || '',
          external: el.getAttribute('target') === '_blank',
          open: function () {
            if (el.getAttribute('target') === '_blank') { W.open(el.href, '_blank', 'noopener'); }
            else { W.location.href = el.href; }
          }
        });
      })(nodes[i]);
    }
  }

  function bindKeys() {
    D.addEventListener('keydown', function (e) {
      var k = (e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'k') { e.preventDefault(); palette.toggle(); return; }
      if (palette.isOpen()) { return; }
      var typing = /^(input|textarea|select)$/i.test((e.target && e.target.tagName) || '') ||
                   (e.target && e.target.isContentEditable);
      if (typing) { return; }
      if (k === 'escape') { stopSpeaking(); voice.stop(); setState('idle', ''); return; }
      if (k === '/') { e.preventDefault(); palette.open(); return; }
      if (k === ' ' && e.shiftKey) { e.preventDefault(); voice.tap(); }
    });
    W.addEventListener('online', function () { setState('idle', ''); });
    W.addEventListener('offline', function () { setState('offline', 'Offline. Local tiles still work.'); });
  }

  function configure(options) {
    options = options || {};
    for (var key in options) {
      if (Object.prototype.hasOwnProperty.call(options, key)) { config[key] = options[key]; }
    }
    if (config.micEl) {
      config.micEl.addEventListener('click', function () { voice.tap(); });
      if (!voice.supported) {
        config.micEl.setAttribute('disabled', 'disabled');
        config.micEl.setAttribute('title', 'Voice needs Edge or Chrome. Press Ctrl+K.');
      }
    }
    if (config.handsFreeEl) {
      config.handsFreeEl.addEventListener('click', function () { voice.toggleHandsFree(); });
      if (!voice.supported) { config.handsFreeEl.style.display = 'none'; }
      voice.paint();
    }
    /* Only promise voice on a surface that actually has a mic control. A page
       with no mic must not tell the user to say "Nexus" at nothing. */
    var hasMic = !!(config.micEl || config.handsFreeEl);
    setState(navigator.onLine === false ? 'offline' : 'idle',
      (hasMic && voice.supported)
        ? 'Say "Nexus ..." then a page or a verb · Ctrl+K for the palette'
        : 'Press Ctrl+K for the command palette');
    return NS.os;
  }

  installBuiltins();
  bindKeys();

  NS.os = {
    version: 2,
    states: STATES.slice(),
    get state() { return state; },
    setState: setState,
    run: run,
    say: say,
    stopSpeaking: stopSpeaking,
    configure: configure,
    registerTarget: registerTarget,
    registerCommand: registerCommand,
    indexTiles: indexTiles,
    verbs: verbList,
    palette: palette,
    voice: voice,
    on: function (fn) { if (typeof fn === 'function') { listeners.push(fn); } }
  };
})();
