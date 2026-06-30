/*
 * smoke-test.js — headless state-machine verification (DEV ONLY).
 * Runs under plain node (no jsdom). Uses a minimal fake document + WebSocket
 * so shell.js / mock-transport.js / source-menu.js load and run.
 *
 *   node smoke-test.js
 *
 * Covers (v6 named-layer model):
 *   (a) layer stacking: show low then high -> high on top, NAV goes to high first.
 *   (b) No Signal re-show: no_signal:true shows it, covering UI suppresses it,
 *       hiding the cover re-shows after the (shortened) timer.
 *   (c) source-menu OK sends "SOURCE <token>".
 *   (d) source-bound base layer (app-usb on USB) stays under overlays.
 *   (e) reorder regression: moving ONE name in LAYER_ORDER flips two screens'
 *       relative z-order — with NO change to the screen definitions. This is the
 *       core v6 guarantee.
 */
'use strict';

// ---- minimal fake DOM (only what screens touch) ----
function fakeEl() {
  return {
    style: {}, className: '', innerHTML: '',
    children: [],
    setAttribute: function () {},
    appendChild: function (c) { this.children.push(c); return c; },
    querySelector: function () { return fakeEl(); },
    classList: { add: function () {}, remove: function () {} }
  };
}
global.document = {
  createElement: function () { return fakeEl(); },
  getElementById: function () { return fakeEl(); },
  documentElement: { classList: { add: function () {}, remove: function () {} } },
  addEventListener: function () {},
  readyState: 'complete',
  body: fakeEl()
};

var fails = 0, passes = 0;
function ok(cond, msg) {
  if (cond) { passes++; console.log('  PASS: ' + msg); }
  else { fails++; console.log('  FAIL: ' + msg); }
}

// ---- load modules ----
var shellMod = require('./shell.js');
var Shell = shellMod.Shell;
var ShellClass = shellMod.ShellClass;
var MockTransport = require('./mock-transport.js');
// load source-menu against the singleton Shell (it references global Shell)
global.Shell = Shell;
require('./screens/source-menu.js');

console.log('\n=== (a) layer stacking + NAV routing ===');
(function () {
  var s = new ShellClass();
  var navLog = [];
  s.register({ id: 'low',  layer: 'source.hdmi', onNav: function () { navLog.push('low');  return true; } });
  s.register({ id: 'high', layer: 'volume',      onNav: function () { navLog.push('high'); return true; } });
  s.show('low');
  ok(s.top() === 'low', 'after show(low) top is low');
  s.show('high');
  ok(s.top() === 'high', 'after show(high) top is high (covers low)');
  ok(s.stack.join(',') === 'low,high', 'stack ascending [low,high]');
  s.handleNav('UP');
  ok(navLog.length === 1 && navLog[0] === 'high', 'NAV routed to top (high) first');
  s.hide('high');
  ok(s.top() === 'low', 'hiding high reveals low');
})();

console.log('\n=== (b) No Signal re-show after cover closes ===');
(function (done) {
  var s = new ShellClass();
  s.reshowMs = 30; // shorten for test
  s.register({ id: 'no-signal', layer: 'no-signal',
    mount: function () {}, onShow: function () {}, onHide: function () {} });
  s.register({ id: 'osd-menu', layer: 'osd-menu',
    mount: function () {}, onShow: function () {}, onHide: function () {} });
  s.currentSource = 'HDMI1'; // external
  s.setNoSignal(true);
  ok(s.stack.indexOf('no-signal') !== -1, 'no_signal:true on external source shows No Signal');
  s.show('osd-menu');
  ok(s.top() === 'osd-menu' && s.stack.indexOf('no-signal') === -1,
     'higher UI (osd-menu) suppresses No Signal');
  s.hide('osd-menu');
  ok(s.stack.indexOf('no-signal') === -1, 'right after cover closes No Signal still hidden (waiting timer)');
  setTimeout(function () {
    ok(s.stack.indexOf('no-signal') !== -1, 'No Signal re-appears after re-show timer');
    // Back on No Signal suppresses then re-shows
    s.back();
    ok(s.stack.indexOf('no-signal') === -1, 'Back on No Signal suppresses it');
    setTimeout(function () {
      ok(s.stack.indexOf('no-signal') !== -1, 'No Signal re-appears after Back timer');
      s.setNoSignal(false);
      ok(s.stack.indexOf('no-signal') === -1, 'no_signal:false hides it for good');
      done();
    }, 50);
  }, 50);
})(afterB);

function afterB() {
  console.log('\n=== (c) source-menu OK sends SOURCE <token> ===');
  var sent = [];
  // fresh shell with a capturing transport, re-register source-menu against it
  var s = new ShellClass();
  global.Shell = s;
  // re-evaluate source-menu module against the new global Shell
  delete require.cache[require.resolve('./screens/source-menu.js')];
  require('./screens/source-menu.js');
  s.attachTransport({
    onLine: function () {},
    send: function (l) { sent.push(l); }
  });
  s.currentSource = 'HDMI1';
  s.handleNav('SOURCE'); // open menu via global route
  ok(s.top() === 'source-menu', 'NAV SOURCE opens source-menu');
  s.handleNav('DOWN');   // HDMI1 -> HDMI2
  s.handleNav('OK');     // pick HDMI2
  ok(sent.indexOf('SOURCE HDMI2') !== -1, 'OK sent "SOURCE HDMI2" (got: ' + sent.join('|') + ')');
  ok(s.top() === null, 'menu closed after OK');
  // HDMI3 must be skipped (disabled/eARC)
  var s2 = new ShellClass(); global.Shell = s2;
  delete require.cache[require.resolve('./screens/source-menu.js')];
  require('./screens/source-menu.js');
  var sent2 = [];
  s2.attachTransport({ onLine: function () {}, send: function (l) { sent2.push(l); } });
  s2.currentSource = 'HDMI2';
  s2.handleNav('SOURCE');
  s2.handleNav('DOWN'); // HDMI2 -> HDMI3 should skip to USB
  s2.handleNav('OK');
  ok(sent2.indexOf('SOURCE HDMI3') === -1, 'HDMI3 (eARC) is not selectable, skipped');

  console.log('\n=== (d) source-bound base layer (app-usb on USB) ===');
  (function () {
    var s = new ShellClass();
    global.Shell = s;
    delete require.cache[require.resolve('./screens/app-usb.js')];
    require('./screens/app-usb.js');
    // a fake overlay to stack on top of the base layer
    s.register({ id: 'audio-volume', layer: 'volume',
      mount: function () {}, onShow: function () {}, onHide: function () {} });

    // (a) currentSource = USB -> app-usb shown as base layer
    s.selectSource('USB');
    ok(s.baseScreen === 'app-usb', '(d.a) source USB -> app-usb is the base layer');
    ok(s._els['app-usb'] && s._els['app-usb'].style.display === 'block',
       '(d.a) app-usb element displayed');
    ok(s.stack.indexOf('app-usb') === -1,
       '(d.a) app-usb is base layer, NOT in overlay stack');

    // (c) overlay on top while USB base exists -> overlay above, base survives
    s.show('audio-volume');
    ok(s.top() === 'audio-volume', '(d.c) overlay (audio-volume) is on top');
    ok(s.baseScreen === 'app-usb' &&
       s._els['app-usb'].style.display === 'block',
       '(d.c) app-usb still base layer, not destroyed, below overlay');
    ok(Number(s._els['audio-volume'].style.zIndex) > Number(s._els['app-usb'].style.zIndex),
       '(d.c) overlay z-index above app-usb base z-index');
    s.hide('audio-volume'); // clean up overlay

    // (b) switch to HDMI2 -> app-usb hidden
    s.selectSource('HDMI2');
    ok(s.baseScreen === null, '(d.b) switch to HDMI2 -> no source-bound base');
    ok(s._els['app-usb'].style.display === 'none',
       '(d.b) app-usb element hidden after leaving USB');
  })();

  console.log('\n=== (e) reorder regression: move one name in LAYER_ORDER ===');
  (function () {
    // Two screens whose definitions are IDENTICAL in both runs — only the table differs.
    function build(reorder) {
      var s = new ShellClass();
      if (reorder) {
        // swap the relative order of 'information' and 'osd-menu' in this instance's table
        var a = s.LAYER_ORDER.indexOf('information');
        var b = s.LAYER_ORDER.indexOf('osd-menu');
        var tmp = s.LAYER_ORDER[a]; s.LAYER_ORDER[a] = s.LAYER_ORDER[b]; s.LAYER_ORDER[b] = tmp;
      }
      s.register({ id: 'A', layer: 'information', mount: function () {}, onShow: function () {} });
      s.register({ id: 'B', layer: 'osd-menu',    mount: function () {}, onShow: function () {} });
      s.show('A'); s.show('B');
      return s.top();
    }
    ok(build(false) === 'B', '(e) default table: osd-menu (B) covers information (A)');
    ok(build(true)  === 'A', '(e) after swapping the two names: information (A) now on top — screen defs unchanged');
  })();

  console.log('\n=== RESULT: ' + passes + ' passed, ' + fails + ' failed ===');
  process.exit(fails ? 1 : 0);
}
