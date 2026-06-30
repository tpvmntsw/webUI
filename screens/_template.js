/*
 * _template.js — copy this to screens/<your-screen>.js and start building.
 *
 * ── id NAMING (mandatory) ───────────────────────────────────────────────
 *   id == filename minus ".js", format `<prefix>-<name>`, all lowercase kebab.
 *   Pick the prefix by category (7 buckets):
 *     source-   source switching        e.g. source-menu
 *     factory-  factory functions       e.g. factory-menu
 *     osd-      OSD main menu (Picture/Sound/Settings)   e.g. osd-menu
 *     info-     read-only info display  e.g. info-display, info-banner
 *     audio-    volume / mute HUD        e.g. audio-volume, audio-mute
 *     sys-      system / fullscreen state  e.g. sys-home, sys-nosignal,
 *                                            sys-blackout, sys-wizard
 *     app-      embedded application screen  e.g. app-usb, app-iwb
 *   NOTE: osd- (OSD settings menu) and audio- (volume/mute HUD) are DIFFERENT
 *   buckets — do not mix them.
 *
 * ── v6 LAYER MODEL (how z-order works now) ──────────────────────────────
 *   You DO NOT pick a z-order number. You pick a NAMED layer from the single
 *   ordered table Shell.LAYER_ORDER (see README "層級表"). The shell decides who
 *   covers whom from that table's order. To find where you sit:
 *       Shell.getLayerRank('osd-menu')   // higher rank = drawn on top
 *   Valid layer names (low -> high):
 *       source.home, source.hdmi, source.usb, blackout, no-signal,
 *       factory, setup-wizard, information, osd-menu, info-banner, volume
 *
 *   Why named, not numbered: re-ordering z-order later = moving one name in
 *   Shell.LAYER_ORDER. Your screen file never changes. (spec v6 §2)
 *
 *   `offset` (optional, default 0): a private sub-band ABOVE your layer's base,
 *   for the rare case where ONE app needs several stacked shell-level screens
 *   (e.g. app-usb base + its own dialog above it, both still under system UI).
 *   Most screens leave it out. Anything you draw *inside* your own `el` stacks
 *   freely with plain CSS z-index and never needs offset.
 *
 * Contract (screenDef):
 *   id       unique string, also used as the global NAV route key where relevant.
 *   layer    REQUIRED layer name from Shell.LAYER_ORDER (replaces the old numeric
 *            priority). Unknown name -> register() throws.
 *   offset   optional number (default 0); your private sub-band, see above.
 *   source   optional SOURCE TOKEN (e.g. 'USB'). Declaring it makes this screen
 *            the OPAQUE source-bound base layer for that source: shell shows it
 *            automatically when that source is selected (under all overlays) and
 *            hides it on source change. Use the matching source.* layer + no
 *            timeout. See app-usb.js.
 *   timeout  optional ms of idle before shell auto-hides this screen (omit = never).
 *   mount(el)         build DOM ONCE into el (el is your private container).
 *   onShow(params)    each time the screen becomes visible.
 *   onHide()          each time it is hidden.
 *   onNav(act)        handle one NAV action; return true if you consumed it
 *                     (return false to let the shell do global routing).
 *   onVal(key,value)  a VAL arrived (Shell.store already updated).
 *
 * Rules of thumb:
 *   - Touch only your own `el`. Never reach into other screens' DOM.
 *   - Read shared state via Shell.store[...] and Shell.currentSource.
 *   - To open/close yourself or others use Shell.show(id)/Shell.hide(id).
 *   - To switch source use Shell.selectSource(token) (sends SOURCE + flips base layer).
 */
(function () {
  'use strict';

  Shell.register({
    id: 'example',
    layer: 'osd-menu',              // a name from Shell.LAYER_ORDER (NOT a number)
    // offset: 0,                   // optional private sub-band; omit for the common case
    timeout: Shell.DEFAULT_TIMEOUT, // 15000ms; omit the field for "never auto-close"

    mount: function (el) {
      el.innerHTML =
        '<div style="position:absolute;top:40%;left:40%;color:#fff;font:24px Arial">' +
        'example screen</div>';
    },

    onShow: function (params) { /* refresh from Shell.store here */ },
    onHide: function () { /* pause timers etc. */ },

    onNav: function (act) {
      if (act === 'BACK') { Shell.hide('example'); return true; }
      return false; // not handled -> shell routes globally
    },

    onVal: function (key, value) { /* react to live DB changes */ }
  });
})();
