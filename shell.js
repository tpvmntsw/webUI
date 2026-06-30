/*
 * shell.js — MT9676 Signage WebUI core shell (PRODUCTION code, board-bound)
 *
 * Responsibilities (per spec v6 §2):
 *   - Shell.register(screenDef): screens self-register a screenDef.
 *   - NAMED layer model (v6): a screen declares `layer:'<name>'`, NOT a magic
 *     number. The single ordered table Shell.LAYER_ORDER decides who covers whom;
 *     to reorder, move a name in that array — no screen file changes needed. App
 *     developers query their slot with Shell.getLayerRank(name). Optional `offset`
 *     (default 0, clamped to a private band) lets one app keep several stacked
 *     sub-screens without colliding with the next layer.
 *   - Layer state machine + overlay stack (higher layer covers lower).
 *   - NAV routing: top active screen first; if it returns false, global routing.
 *   - VAL store cache + onVal fan-out.
 *   - base layer: HOME -> black, external source -> transparent, OR a screen that
 *     declares `source: '<TOKEN>'` becomes the opaque source-bound base layer for
 *     that source (shown below every overlay, auto shown/hidden on source change).
 *   - No Signal re-show logic (§1.5): auto re-appear N seconds after a covering
 *     UI closes, or N seconds after Back, while no_signal is still true.
 *   - per-screen idle timeout (default 15000ms).
 *   - Back: close top overlay; when all closed, stay on current source (no switch, §6).
 *   - transport abstraction: real WS on board, mock in devkit.
 *
 * Environment-agnostic: this file MUST load under Node (no browser globals at
 * load time) so the smoke test can drive the state machine headless.
 * DOM is only touched inside mount/onShow/onHide which screens own; the shell
 * itself guards every `document` access with hasDOM().
 */
(function (global) {
  'use strict';

  var DEFAULT_TIMEOUT = 15000;       // §8 unified idle auto-close
  var NO_SIGNAL_RESHOW_MS = 5000;    // §1.5 N seconds re-show delay (overridable)
  var LAYER_STEP = 1000;             // per-layer band; offset must stay within [0, LAYER_STEP)
  var EXTERNAL_SOURCES = { HDMI1: 1, HDMI2: 1, HDMI3: 1, USB: 1 };

  // v6 §2.1 — the SINGLE source of truth for z-order. Ascending = low -> high.
  // Reorder z-order by moving a NAME here; screen files never change.
  var DEFAULT_LAYER_ORDER = [
    'source.home',    // Home / transparent source (base)
    'source.hdmi',    // HDMI source base
    'source.usb',     // USB source base
    'blackout',       // 遮黑 (mid source-switch)
    'no-signal',      // No Signal
    'factory',        // Factory Menu
    'setup-wizard',   // SetupWizard
    'information',    // Information (Display 3-step)
    'osd-menu',       // OSD Menu / Source Menu
    'info-banner',    // Info banner (post-switch toast)
    'volume'          // Volume / Mute
  ];

  function hasDOM() {
    return typeof document !== 'undefined' && document &&
           typeof document.createElement === 'function';
  }

  function now() { return Date.now(); }

  function clamp(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }

  function Shell() {
    this.screens = {};        // id -> screenDef
    this.sourceBound = {};    // SOURCE TOKEN -> screen id (declared via screenDef.source)
    this.baseScreen = null;   // id of the source-bound screen currently shown as base layer
    this.stack = [];          // array of ids, ascending layer (top = last)
    this.store = {};          // VAL cache
    this.currentSource = 'HOME';
    this.noSignal = false;
    this.transport = null;
    this.stageEl = null;      // container; screens mount children here
    this._mounted = {};       // id -> true once mount() ran
    this._els = {};           // id -> element handed to the screen
    this._timers = {};        // id -> timeout handle
    this._noSignalTimer = null;
    this._noSignalSuppressed = false; // Back/cover suppressed it; waiting to re-show
    this.reshowMs = NO_SIGNAL_RESHOW_MS;
    this.listeners = {};      // event -> [fn]
    this.LAYER_ORDER = DEFAULT_LAYER_ORDER.slice(); // per-instance so tests can reorder
  }

  Shell.prototype.DEFAULT_TIMEOUT = DEFAULT_TIMEOUT;
  Shell.prototype.LAYER_STEP = LAYER_STEP;

  // ---- v6 named layer API ----
  // Rank of a named layer = its index in LAYER_ORDER (higher = on top). -1 if unknown.
  Shell.prototype.getLayerRank = function (name) {
    return this.LAYER_ORDER.indexOf(name);
  };

  // Internal absolute priority used by the stack machine: rank*STEP + clamped offset.
  Shell.prototype._priorityOf = function (def) {
    var rank = this.getLayerRank(def.layer);
    if (rank < 0) return -1;
    var offset = clamp((typeof def.offset === 'number' ? def.offset : 0), 0, LAYER_STEP - 1);
    return rank * LAYER_STEP + offset;
  };

  Shell.prototype._noSignalPriority = function () {
    return this.getLayerRank('no-signal') * LAYER_STEP;
  };

  // ---- tiny event bus (dev-panel / tests observe) ----
  Shell.prototype.on = function (ev, fn) {
    (this.listeners[ev] = this.listeners[ev] || []).push(fn);
  };
  Shell.prototype._emit = function (ev, data) {
    var fns = this.listeners[ev] || [];
    for (var i = 0; i < fns.length; i++) {
      try { fns[i](data); } catch (e) { /* dev observers must not break shell */ }
    }
  };

  // ---- registration ----
  Shell.prototype.register = function (def) {
    if (!def || !def.id) throw new Error('screenDef needs an id');
    if (typeof def.layer !== 'string' || !def.layer) {
      throw new Error('screenDef ' + def.id + ' needs a layer name (see Shell.LAYER_ORDER)');
    }
    if (this.getLayerRank(def.layer) < 0) {
      throw new Error('screenDef ' + def.id + ' has unknown layer "' + def.layer +
                      '" (not in Shell.LAYER_ORDER)');
    }
    def._priority = this._priorityOf(def);   // cached absolute priority for the stack machine
    this.screens[def.id] = def;
    // source-bound screen: becomes the opaque base layer when its source is active
    if (typeof def.source === 'string' && def.source) {
      this.sourceBound[def.source] = def.id;
      // if that source is already current, surface it as the base layer now
      if (this.currentSource === def.source) this._applyBaseLayer();
    }
    this._emit('register', def.id);
    return this;
  };

  Shell.prototype.isRegistered = function (id) { return !!this.screens[id]; };

  // ---- DOM helpers (no-op when headless) ----
  Shell.prototype._ensureEl = function (id) {
    if (this._els[id]) return this._els[id];
    var el;
    if (hasDOM()) {
      el = document.createElement('div');
      el.className = 'screen screen-' + id;
      el.style.display = 'none';
      el.setAttribute('data-screen', id);
      if (this.stageEl) this.stageEl.appendChild(el);
    } else {
      el = { _id: id, style: { display: 'none' }, _fake: true };
    }
    this._els[id] = el;
    return el;
  };

  Shell.prototype._mountOnce = function (def) {
    if (this._mounted[def.id]) return;
    var el = this._ensureEl(def.id);
    if (typeof def.mount === 'function') def.mount(el);
    this._mounted[def.id] = true;
  };

  // ---- stack / visibility ----
  Shell.prototype.top = function () {
    return this.stack.length ? this.stack[this.stack.length - 1] : null;
  };

  Shell.prototype.isActive = function (id) { return this.top() === id; };

  Shell.prototype._setElDisplay = function (id, show) {
    var el = this._els[id];
    if (el && el.style) {
      el.style.display = show ? 'block' : 'none';
      // overlays always paint above a source-bound base layer (z-index 0)
      if (show) el.style.zIndex = '10';
    }
  };

  // Recompute which stacked screen is visible: only the topmost is shown,
  // those below are hidden (mutual exclusion, §2).
  Shell.prototype._reflow = function () {
    for (var i = 0; i < this.stack.length; i++) {
      this._setElDisplay(this.stack[i], i === this.stack.length - 1);
    }
    this._emit('stack', this.stack.slice());
  };

  // ---- timeout handling ----
  Shell.prototype._clearTimer = function (id) {
    if (this._timers[id]) {
      clearTimeout(this._timers[id]);
      delete this._timers[id];
    }
  };

  Shell.prototype._armTimer = function (id) {
    var def = this.screens[id];
    this._clearTimer(id);
    var ms = (def && typeof def.timeout === 'number') ? def.timeout : null;
    if (ms == null) return; // no auto-close
    var self = this;
    this._timers[id] = setTimeout(function () { self.hide(id); }, ms);
  };

  // ---- show / hide ----
  Shell.prototype.show = function (id, params) {
    var def = this.screens[id];
    if (!def) { this._emit('warn', 'show unknown screen ' + id); return false; }

    this._mountOnce(def);

    // already in stack: bring to logical top by re-sorting on layer
    var idx = this.stack.indexOf(id);
    if (idx !== -1) this.stack.splice(idx, 1);

    // insert by layer priority so the array stays ascending; top() == highest visible
    var inserted = false;
    for (var i = 0; i < this.stack.length; i++) {
      if (def._priority < this.screens[this.stack[i]]._priority) {
        this.stack.splice(i, 0, id);
        inserted = true;
        break;
      }
    }
    if (!inserted) this.stack.push(id);

    // No Signal gets covered by anything above it -> suppress, mark for re-show
    this._maybeSuppressNoSignal();

    this._reflow();
    if (typeof def.onShow === 'function') def.onShow(params || {});
    this._armTimer(id);
    this._emit('show', id);
    return true;
  };

  Shell.prototype.hide = function (id) {
    var idx = this.stack.indexOf(id);
    if (idx === -1) return false;
    var def = this.screens[id];
    this.stack.splice(idx, 1);
    this._clearTimer(id);
    this._setElDisplay(id, false);
    this._reflow();
    if (def && typeof def.onHide === 'function') def.onHide();
    this._emit('hide', id);

    // If a covering UI just closed and no_signal still true, schedule re-show.
    if (id !== 'no-signal') this._scheduleNoSignalReshowIfNeeded();
    return true;
  };

  // close topmost overlay (Back semantics §6)
  Shell.prototype.back = function () {
    var t = this.top();
    if (t == null) return false;
    if (t === 'no-signal') {
      // §1.5: Back on No Signal -> suppress, re-show after N seconds
      this.hide('no-signal');
      this._noSignalSuppressed = true;
      this._scheduleNoSignalReshow();
      return true;
    }
    this.hide(t);
    return true;
  };

  // ---- No Signal cross-cutting logic (§1.5) ----
  Shell.prototype._isExternal = function () {
    return !!EXTERNAL_SOURCES[this.currentSource];
  };

  Shell.prototype._clearNoSignalTimer = function () {
    if (this._noSignalTimer) { clearTimeout(this._noSignalTimer); this._noSignalTimer = null; }
  };

  Shell.prototype._scheduleNoSignalReshow = function () {
    var self = this;
    this._clearNoSignalTimer();
    this._noSignalTimer = setTimeout(function () {
      self._noSignalTimer = null;
      self._noSignalSuppressed = false;
      if (self.noSignal && self._isExternal()) self._showNoSignal();
    }, this.reshowMs);
  };

  Shell.prototype._scheduleNoSignalReshowIfNeeded = function () {
    if (!this.noSignal || !this._isExternal()) return;
    if (this.stack.indexOf('no-signal') !== -1) return; // already shown
    // only schedule if something is NOT currently covering it
    if (this._higherThanNoSignalPresent()) return;
    this._scheduleNoSignalReshow();
  };

  Shell.prototype._higherThanNoSignalPresent = function () {
    var threshold = this._noSignalPriority();
    for (var i = 0; i < this.stack.length; i++) {
      var id = this.stack[i];
      if (id === 'no-signal') continue;
      if (this.screens[id]._priority >= threshold) return true;
    }
    return false;
  };

  Shell.prototype._maybeSuppressNoSignal = function () {
    if (this.stack.indexOf('no-signal') === -1) return;
    if (this._higherThanNoSignalPresent()) {
      // hide it (kept logically out of stack); will re-show when cover closes
      var idx = this.stack.indexOf('no-signal');
      if (idx !== -1) {
        this.stack.splice(idx, 1);
        this._setElDisplay('no-signal', false);
        this._clearTimer('no-signal');
      }
    }
  };

  Shell.prototype._showNoSignal = function () {
    if (!this.isRegistered('no-signal')) {
      // No Signal screen not yet built by team; still honor the state via event
      this._emit('no-signal-show', true);
      return;
    }
    this.show('no-signal');
  };

  // called by transport when WS pushes no_signal state
  Shell.prototype.setNoSignal = function (flag) {
    this.noSignal = !!flag;
    this._emit('no_signal', this.noSignal);
    if (this.noSignal) {
      if (!this._isExternal()) return; // §1.5 only external sources
      this._noSignalSuppressed = false;
      if (!this._higherThanNoSignalPresent()) this._showNoSignal();
    } else {
      this._clearNoSignalTimer();
      this._noSignalSuppressed = false;
      if (this.stack.indexOf('no-signal') !== -1) this.hide('no-signal');
    }
  };

  // ---- NAV / VAL ingress ----
  Shell.prototype.handleNav = function (act) {
    act = (act || '').trim();
    if (!act) return;
    this._emit('nav', act);

    // 1) top active screen gets first crack
    var t = this.top();
    if (t) {
      var def = this.screens[t];
      this._armTimer(t); // any nav is "activity" -> reset idle timeout
      if (def && typeof def.onNav === 'function' && def.onNav(act) === true) {
        return; // consumed
      }
    }
    // 2) global routing
    this._globalNav(act);
  };

  Shell.prototype._globalNav = function (act) {
    switch (act) {
      case 'MENU':   if (this.isRegistered('osd-menu')) this.show('osd-menu'); break;
      case 'SOURCE': if (this.isRegistered('source-menu')) this.show('source-menu'); break;
      case 'BACK':   this.back(); break;
      case 'VOL+':
      case 'VOL-':
      case 'MUTE':   if (this.isRegistered('audio-volume')) this.show('audio-volume', { act: act }); break;
      case 'DISPLAY': if (this.isRegistered('info-display')) this.show('info-display'); break;
      default: this._emit('nav-unhandled', act); break;
    }
  };

  Shell.prototype.handleVal = function (key, value) {
    this.store[key] = value;
    if (key === 'generic_input_source') {
      this.currentSource = value;
      this._applyBaseLayer();
    }
    this._emit('val', { key: key, value: value });
    // fan-out to every registered screen (store already updated)
    for (var id in this.screens) {
      if (!this.screens.hasOwnProperty(id)) continue;
      var def = this.screens[id];
      if (typeof def.onVal === 'function') {
        try { def.onVal(key, value); } catch (e) { this._emit('warn', 'onVal ' + id + ' ' + e); }
      }
    }
  };

  // raw line from transport ("NAV x" / "VAL k v" / "OK"/"PONG"/...)
  Shell.prototype.ingest = function (line) {
    if (typeof line !== 'string') return;
    if (line.indexOf('NAV ') === 0) { this.handleNav(line.slice(4)); return; }
    if (line.indexOf('VAL ') === 0) {
      var rest = line.slice(4);
      var sp = rest.indexOf(' ');
      var k = sp === -1 ? rest : rest.slice(0, sp);
      var v = sp === -1 ? '' : rest.slice(sp + 1);
      this.handleVal(k, v);
      return;
    }
    // bare OK / PONG / ERR / DUMP header -> ignore (per skeleton baseline)
  };

  // ---- source switching ----
  Shell.prototype.selectSource = function (token) {
    this.currentSource = token;
    this._applyBaseLayer();
    this.send('SOURCE ' + token);
    this._emit('source', token);
    // leaving an external source clears any pending No Signal
    if (!this._isExternal()) {
      this._clearNoSignalTimer();
      if (this.stack.indexOf('no-signal') !== -1) this.hide('no-signal');
    }
  };

  // Base layer = what sits under every overlay for the current source.
  //   HOME            -> black (no transparent class, no source-bound screen)
  //   external source with a registered source-bound screen -> that screen, opaque
  //   external source without one -> html.transparent (let board video show through)
  Shell.prototype._applyBaseLayer = function () {
    var boundId = this.sourceBound[this.currentSource] || null;

    // hide a previously shown source-bound base screen if it no longer applies
    if (this.baseScreen && this.baseScreen !== boundId) {
      this._hideBase(this.baseScreen);
      this.baseScreen = null;
    }

    if (boundId) {
      // opaque source-bound content: no transparency, mount + show as base layer
      if (!hasDOM()) { this.baseScreen = boundId; return; }
      var root = document.documentElement;
      if (root && root.classList) root.classList.remove('transparent');
      this._showBase(boundId);
      this.baseScreen = boundId;
      return;
    }

    // no source-bound screen: original behavior (HOME=black, external=transparent)
    if (!hasDOM()) return;
    var transparent = this.currentSource !== 'HOME';
    var rt = document.documentElement;
    if (rt && rt.classList) {
      if (transparent) rt.classList.add('transparent');
      else rt.classList.remove('transparent');
    }
  };

  Shell.prototype._showBase = function (id) {
    var def = this.screens[id];
    if (!def) return;
    this._mountOnce(def);
    var el = this._els[id];
    if (el && el.style) {
      el.style.display = 'block';
      el.style.zIndex = '0';     // base layer sits beneath every overlay (stack uses default/auto)
    }
    if (typeof def.onShow === 'function') def.onShow({ base: true });
    this._emit('base-show', id);
  };

  Shell.prototype._hideBase = function (id) {
    var def = this.screens[id];
    this._setElDisplay(id, false);
    if (def && typeof def.onHide === 'function') def.onHide();
    this._emit('base-hide', id);
  };

  // ---- transport ----
  Shell.prototype.attachTransport = function (t) {
    this.transport = t;
    var self = this;
    t.onLine(function (line) { self.ingest(line); });
    return this;
  };

  Shell.prototype.send = function (line) {
    if (this.transport && typeof this.transport.send === 'function') {
      this.transport.send(line);
    }
    this._emit('send', line);
  };

  // ---- boot ----
  Shell.prototype.boot = function (opts) {
    opts = opts || {};
    if (hasDOM()) this.stageEl = document.getElementById(opts.stageId || 'stage');
    if (this.transport && typeof this.transport.open === 'function') {
      var self = this;
      this.transport.open(function () { self.send('DUMP'); });
    }
    this._applyBaseLayer();
    this._emit('boot', true);
    return this;
  };

  var instance = new Shell();
  global.Shell = instance;
  global.ShellClass = Shell; // exposed for tests that want fresh instances

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Shell: instance, ShellClass: Shell };
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
