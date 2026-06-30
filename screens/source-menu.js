/*
 * source-menu.js — Source (Input) menu, migrated from skeleton into a real
 * Shell screen. Reference: spec v6 §1.2 + Panasonic example input.html.
 *
 * layer 'osd-menu' (v6 §2 — OSD Menu / Source Menu share one layer). Opened by global NAV "SOURCE".
 * UP/DOWN move selection, OK switches source and closes, BACK closes without switching.
 * HDMI3 is greyed out (eARC) per v3 §1 — PROVISIONAL, see v3 §9-C1 (awaiting
 * on-board dump to confirm which HDMI is eARC). Adjust SOURCES.disabled if dump
 * proves HDMI1 is the eARC port instead.
 */
(function () {
  'use strict';

  var SOURCES = [
    { token: 'HDMI1', label: 'HDMI1', disabled: false },
    { token: 'HDMI2', label: 'HDMI2', disabled: false },
    { token: 'HDMI3', label: 'HDMI3', disabled: true }, // eARC, provisional (v3 §9-C1)
    { token: 'USB',   label: 'USB',   disabled: false }
  ];

  var sel = 0;          // index into SOURCES
  var listEl = null;

  function firstSelectable() {
    for (var i = 0; i < SOURCES.length; i++) if (!SOURCES[i].disabled) return i;
    return 0;
  }

  function move(dir) {
    var n = SOURCES.length;
    var i = sel;
    do {
      i = (i + dir + n) % n;
    } while (SOURCES[i].disabled && i !== sel);
    sel = i;
    render();
  }

  function render() {
    if (!listEl) return;
    var html = '';
    for (var i = 0; i < SOURCES.length; i++) {
      var s = SOURCES[i];
      var cls = 'sm-item';
      if (s.disabled) cls += ' sm-disabled';
      else if (i === sel) cls += ' sm-active';
      html += '<div class="' + cls + '">' + s.label + '</div>';
    }
    // decorative blank rows like the example
    html += '<div class="sm-item"></div><div class="sm-item"></div>';
    listEl.innerHTML = html;
  }

  Shell.register({
    id: 'source-menu',
    layer: 'osd-menu',     // v6 §2: Source Menu shares the osd-menu layer

    mount: function (el) {
      el.innerHTML =
        '<style>' +
        '.sm-menu{width:280px;background:#727272;border:2px solid #444;position:absolute;top:10px;right:10px;box-shadow:0 4px 20px rgba(0,0,0,.5);font-family:Arial,sans-serif}' +
        '.sm-header{background:#344a77;color:#fff;text-align:center;padding:8px 0;font-weight:bold;font-size:1.2rem;border-bottom:1px solid #222}' +
        '.sm-item{height:38px;display:flex;align-items:center;justify-content:center;color:#e0e0e0;font-weight:bold;font-size:1.1rem;border-bottom:1px solid #717171}' +
        '.sm-item.sm-active{background:#ffc239;color:#333}' +
        '.sm-item.sm-disabled{color:#999;opacity:.5}' +
        '.sm-footer{background:#344a77;padding:10px 0;display:flex;justify-content:center;border-top:1px solid #222}' +
        '.sm-badge{background:#f0f0f0;color:#000;padding:1px 12px;border-radius:8px;font-size:.9rem;font-weight:900;border:3px solid #333}' +
        '</style>' +
        '<div class="sm-menu">' +
        '<div class="sm-header">Input</div>' +
        '<div class="sm-list"></div>' +
        '<div class="sm-footer"><span class="sm-badge">ENTER</span></div>' +
        '</div>';
      listEl = el.querySelector('.sm-list');
    },

    onShow: function () {
      // start selection on current source if selectable, else first selectable
      sel = firstSelectable();
      for (var i = 0; i < SOURCES.length; i++) {
        if (SOURCES[i].token === Shell.currentSource && !SOURCES[i].disabled) { sel = i; break; }
      }
      render();
    },

    onHide: function () {},

    onNav: function (act) {
      switch (act) {
        case 'UP':     move(-1); return true;
        case 'DOWN':   move(1);  return true;
        case 'OK':
          var s = SOURCES[sel];
          if (!s.disabled) {
            Shell.selectSource(s.token); // sends SOURCE <token>
            Shell.hide('source-menu');
          }
          return true;
        case 'BACK':
        case 'SOURCE': // same key re-press closes (v3 §1.2)
          Shell.hide('source-menu');
          return true;
      }
      return false;
    },

    onVal: function (key, value) {}
  });
})();
