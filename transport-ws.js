/*
 * transport-ws.js — real WebSocket transport (PRODUCTION, board).
 * Connects ws://127.0.0.1:3000/web_ui, subprotocol "signage".
 * Auto-reconnect 1s (matches skeleton baseline §2.1).
 *
 * Contract with shell:
 *   .open(onOpen)   -> connect; call onOpen() each time the socket opens.
 *   .onLine(cb)     -> register a line handler; cb(line) per incoming text line.
 *   .send(line)     -> send a text line if open.
 */
(function (global) {
  'use strict';

  var WS_URL = 'ws://127.0.0.1:3000/web_ui';
  var SUBPROTO = 'signage';

  function WsTransport(url) {
    this.url = url || WS_URL;
    this.ws = null;
    this._lineCbs = [];
    this._onOpen = null;
    this._retry = null;
  }

  WsTransport.prototype.onLine = function (cb) { this._lineCbs.push(cb); };

  WsTransport.prototype._emitLine = function (line) {
    for (var i = 0; i < this._lineCbs.length; i++) this._lineCbs[i](line);
  };

  WsTransport.prototype.open = function (onOpen) {
    this._onOpen = onOpen || this._onOpen;
    this._connect();
  };

  WsTransport.prototype._connect = function () {
    var self = this;
    var WSImpl = global.WebSocket;
    if (!WSImpl) throw new Error('WebSocket not available in this environment');
    try {
      this.ws = new WSImpl(this.url, SUBPROTO);
    } catch (e) {
      this._scheduleReconnect();
      return;
    }
    this.ws.onopen = function () {
      if (typeof self._onOpen === 'function') self._onOpen();
    };
    this.ws.onmessage = function (ev) {
      var data = ev && ev.data != null ? String(ev.data) : '';
      var lines = data.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i].replace(/\r$/, '');
        if (ln) self._emitLine(ln);
      }
    };
    this.ws.onclose = function () { self._scheduleReconnect(); };
    this.ws.onerror = function () { /* onclose will follow */ };
  };

  WsTransport.prototype._scheduleReconnect = function () {
    var self = this;
    if (this._retry) return;
    this._retry = setTimeout(function () {
      self._retry = null;
      self._connect();
    }, 1000);
  };

  WsTransport.prototype.send = function (line) {
    if (this.ws && this.ws.readyState === 1 /* OPEN */) {
      this.ws.send(line);
    }
  };

  global.WsTransport = WsTransport;
  if (typeof module !== 'undefined' && module.exports) module.exports = WsTransport;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
