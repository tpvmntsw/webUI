/*
 * dev-panel.js — floating dev console (DEV ONLY, never loaded on the board).
 * Sends NAV via the mock transport (acting as flow_control), toggles no_signal,
 * fires signal lock, switches source, and shows live shell state.
 *
 * Expects a global `mock` (MockTransport instance) created by index.html.
 */
(function (global) {
  'use strict';
  if (typeof document === 'undefined') return; // headless: no-op

  var NAV_KEYS = ['MENU', 'SOURCE', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'OK', 'BACK',
                  'VOL+', 'VOL-', 'MUTE', 'DISPLAY', 'OPTION', 'INFO'];
  var DIGITS = ['0','1','2','3','4','5','6','7','8','9'];
  var SOURCE_TOKENS = ['HOME', 'HDMI1', 'HDMI2', 'HDMI3', 'USB'];

  // Playback control keys with SVG icons
  var PLAYBACK_KEYS = [
    { key: 'PLAY', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>', title: 'Play/Pause' },
    { key: 'STOP', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg>', title: 'Stop' },
    { key: 'REW', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>', title: 'Rewind' },
    { key: 'FF', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>', title: 'Fast Forward' },
    { key: 'PREV_FRAME', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>', title: 'Previous Frame' },
    { key: 'NEXT_FRAME', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/></svg>', title: 'Next Frame' }
  ];

  function el(tag, props, html) {
    var e = document.createElement(tag);
    if (props) for (var k in props) e.style[k] = props[k];
    if (html != null) e.innerHTML = html;
    return e;
  }

  function build() {
    var mock = global.mock;
    var panel = el('div', {
      position: 'fixed', bottom: '8px', right: '8px', width: '300px',
      background: 'rgba(20,20,28,.94)', color: '#cde', font: '11px monospace',
      border: '1px solid #456', borderRadius: '6px', padding: '8px',
      zIndex: '99999', maxHeight: '92vh', overflow: 'auto'
    });
    panel.id = 'dev-panel';

    var title = el('div', { fontWeight: 'bold', marginBottom: '6px', color: '#9cf' },
      'DEV PANEL (mock)');
    panel.appendChild(title);

    function btnRow(labels, onClick) {
      var row = el('div', { display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '5px' });
      labels.forEach(function (l) {
        var b = el('button', null, l);
        b.style.cssText = 'background:#234;color:#cde;border:1px solid #456;border-radius:3px;padding:3px 5px;cursor:pointer;font:11px monospace';
        b.onclick = function () { onClick(l); };
        row.appendChild(b);
      });
      return row;
    }

    panel.appendChild(el('div', { color: '#789' }, 'NAV:'));
    panel.appendChild(btnRow(NAV_KEYS, function (k) { mock.pushNav(k); }));
    panel.appendChild(el('div', { color: '#789' }, 'Digits (Menu+1+9+9+9 = Factory):'));
    panel.appendChild(btnRow(DIGITS, function (k) { mock.pushNav(k); }));

    // Playback controls with SVG icons
    panel.appendChild(el('div', { color: '#789', marginTop: '6px' }, 'Playback:'));
    var playbackRow = el('div', { display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '5px' });
    PLAYBACK_KEYS.forEach(function (item) {
      var b = el('button', null);
      b.innerHTML = item.icon;
      b.title = item.title;
      b.style.cssText = 'background:#234;color:#cde;border:1px solid #456;border-radius:3px;padding:4px 6px;cursor:pointer;display:flex;align-items:center;justify-content:center;min-width:28px;height:24px';
      b.onclick = function () { mock.pushNav(item.key); };
      playbackRow.appendChild(b);
    });
    panel.appendChild(playbackRow);

    // no_signal + signal lock
    var sigRow = el('div', { display: 'flex', gap: '3px', marginBottom: '5px' });
    var bNoSig = el('button', null, 'no_signal: OFF');
    bNoSig.style.cssText = 'background:#234;color:#cde;border:1px solid #456;border-radius:3px;padding:3px 6px;cursor:pointer;font:11px monospace';
    var nsState = false;
    bNoSig.onclick = function () {
      nsState = !nsState;
      mock.setNoSignal(nsState);
      bNoSig.textContent = 'no_signal: ' + (nsState ? 'ON' : 'OFF');
    };
    var bLock = el('button', null, 'signal lock');
    bLock.style.cssText = 'background:#234;color:#cde;border:1px solid #456;border-radius:3px;padding:3px 6px;cursor:pointer;font:11px monospace';
    bLock.onclick = function () { mock.signalLock(); nsState = false; bNoSig.textContent = 'no_signal: OFF'; };
    sigRow.appendChild(bNoSig); sigRow.appendChild(bLock);
    panel.appendChild(sigRow);

    // source dropdown
    var srcRow = el('div', { marginBottom: '6px' });
    srcRow.appendChild(el('span', { color: '#789' }, 'source: '));
    var dd = document.createElement('select');
    dd.style.cssText = 'background:#234;color:#cde;border:1px solid #456;font:11px monospace';
    SOURCE_TOKENS.forEach(function (s) {
      var o = document.createElement('option'); o.value = s; o.textContent = s; dd.appendChild(o);
    });
    dd.onchange = function () { global.Shell.selectSource(dd.value); };
    srcRow.appendChild(dd);
    panel.appendChild(srcRow);

    // USB simulation controls
    panel.appendChild(el('div', { color: '#789', marginTop: '6px' }, 'USB Simulation:'));
    var usbRow = el('div', { display: 'flex', gap: '3px', marginBottom: '5px', flexWrap: 'wrap' });
    var usbNameInput = document.createElement('input');
    usbNameInput.type = 'text';
    usbNameInput.placeholder = 'USB name (e.g. SanDisk 64GB)';
    usbNameInput.style.cssText = 'background:#234;color:#cde;border:1px solid #456;border-radius:3px;padding:3px 5px;font:11px monospace;width:140px';
    usbRow.appendChild(usbNameInput);

    var bInsertUsb = el('button', null, 'Insert USB');
    bInsertUsb.style.cssText = 'background:#264;color:#cde;border:1px solid #456;border-radius:3px;padding:3px 6px;cursor:pointer;font:11px monospace';
    bInsertUsb.onclick = function () {
      var name = usbNameInput.value.trim() || 'USB Storage Device';
      mock.insertUsb(name);
      usbNameInput.value = '';
    };
    usbRow.appendChild(bInsertUsb);

    var bRemoveUsb = el('button', null, 'Remove All USB');
    bRemoveUsb.style.cssText = 'background:#642;color:#cde;border:1px solid #456;border-radius:3px;padding:3px 6px;cursor:pointer;font:11px monospace';
    bRemoveUsb.onclick = function () { mock.removeUsb(); };
    usbRow.appendChild(bRemoveUsb);

    panel.appendChild(usbRow);

    // live state readout
    var state = el('div', { borderTop: '1px solid #345', paddingTop: '5px', whiteSpace: 'pre-wrap' });
    state.id = 'dev-state';
    panel.appendChild(state);

    document.body.appendChild(panel);

    var log = [];
    function refresh() {
      var S = global.Shell;
      state.innerHTML =
        '<b>source:</b> ' + S.currentSource + '\n' +
        '<b>no_signal:</b> ' + S.noSignal + '\n' +
        '<b>stack:</b> [' + S.stack.join(' < ') + ']\n' +
        '<b>top:</b> ' + (S.top() || '-') + '\n' +
        '<b>log:</b>\n' + log.slice(-8).join('\n');
    }
    function push(s) { log.push(s); if (log.length > 40) log.shift(); refresh(); }

    var S = global.Shell;
    S.on('send', function (l) { push('-> ' + l); });
    S.on('nav', function (a) { push('<- NAV ' + a); });
    S.on('val', function (d) { push('<- VAL ' + d.key + ' ' + d.value); });
    S.on('show', function (id) { push('show ' + id); });
    S.on('hide', function (id) { push('hide ' + id); });
    S.on('source', function (s) { push('source=' + s); });
    refresh();
    setInterval(refresh, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})(typeof window !== 'undefined' ? window : this);
