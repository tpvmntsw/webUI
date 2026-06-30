/*
 * mock-transport.js — in-browser fake flow_control (DEV ONLY).
 * Same transport contract as transport-ws.js so shell.js doesn't know the
 * difference. Seeds a kv store from db_list.txt (OTS_DEFAULTS), answers
 * DUMP / GET / SOURCE, and exposes inject API for the dev-panel.
 *
 * NOTE: not loaded on the board. Board uses transport-ws.js.
 */
(function (global) {
  'use strict';

  // OTS_DEFAULTS inlined from wiki/raw/db_list.txt (no runtime file read).
  var DEFAULTS = {
    picture_picture_mode: 'Standard',
    picture_advanced_aspect_ratio: 'Full',
    picture_advanced_overscan: 'Off',
    picture_advanced_color_temp_preset: 'Native',
    picture_advanced_color_temp_custom_r: '128',
    picture_advanced_color_temp_custom_g: '128',
    picture_advanced_color_temp_custom_b: '128',
    picture_advanced_noise_reduction: 'Off',
    picture_advanced_dynamic_backlight_ctrl: 'Off',
    picture_advanced_gamma: '2.2',
    picture_advanced_hdmi_rgb_input_range: 'Auto',
    picture_advanced_dynamic_contrast: 'Off',
    picture_backlight: '25',
    picture_brightness: '50',
    picture_contrast: '50',
    picture_color: '50',
    picture_tint: '50',
    picture_sharpness: '31',
    sound_treble: '15',
    sound_bass: '15',
    sound_balance: '50',
    sound_speaker: 'Enable',
    sound_audio_output: 'Variable',
    setup_language: 'English',
    setup_date_and_time: '1781572007',
    setup_timezone: 'Asia/Taipei',
    setup_setup_timer_program_1: 'Off,12:00,,0,HDMI1',
    setup_setup_timer_program_2: 'Off,12:00,,0,HDMI1',
    setup_setup_timer_program_3: 'Off,12:00,,0,HDMI1',
    setup_setup_timer_program_4: 'Off,12:00,,0,HDMI1',
    setup_setup_timer_program_5: 'Off,12:00,,0,HDMI1',
    setup_setup_timer_program_6: 'Off,12:00,,0,HDMI1',
    setup_setup_timer_program_7: 'Off,12:00,,0,HDMI1',
    setup_hdmi_cec_control: 'Off',
    setup_edid_select_hdmi1: '4K/60p',
    setup_edid_select_hdmi2: '4K/60p',
    setup_edid_select_hdmi3: '4K/60p',
    setup_network_settings_serial_lan_select: 'SERIAL IN',
    setup_network_settings_lan_dhcp: 'Use',
    setup_network_settings_lan_ip_address: '',
    setup_network_settings_lan_subnet_mask: '',
    setup_network_settings_lan_gateway: '',
    setup_network_settings_lan_mac_address: 'FF:FF:FF:FF:FF:FF',
    setup_network_settings_lan_password_web: '',
    setup_network_settings_lan_control: 'Off',
    setup_network_settings_lan_command_port: '1024',
    setup_power_save_mode: 'Enable',
    setup_power_management: 'Off',
    setup_front_indicator_light: 'On',
    setup_quick_start: 'Off',
    generic_volume: '20',
    generic_input_source: 'HDMI1'
  };

  function MockTransport() {
    this.kv = {};
    for (var k in DEFAULTS) if (DEFAULTS.hasOwnProperty(k)) this.kv[k] = DEFAULTS[k];
    this._lineCbs = [];
    this._onOpen = null;
  }

  MockTransport.prototype.onLine = function (cb) { this._lineCbs.push(cb); };

  MockTransport.prototype._emitLine = function (line) {
    var self = this;
    // async to mimic socket delivery; keeps shell re-entrancy realistic
    setTimeout(function () {
      for (var i = 0; i < self._lineCbs.length; i++) self._lineCbs[i](line);
    }, 0);
  };

  MockTransport.prototype.open = function (onOpen) {
    this._onOpen = onOpen;
    var self = this;
    setTimeout(function () { if (self._onOpen) self._onOpen(); }, 0);
  };

  // shell -> mock (outgoing commands from web_ui)
  MockTransport.prototype.send = function (line) {
    if (line === 'DUMP') {
      for (var k in this.kv) if (this.kv.hasOwnProperty(k)) this._emitLine('VAL ' + k + ' ' + this.kv[k]);
      this._emitLine('OK');
      return;
    }
    if (line.indexOf('GET ') === 0) {
      var key = line.slice(4).trim();
      this._emitLine('VAL ' + key + ' ' + (this.kv[key] != null ? this.kv[key] : ''));
      return;
    }
    if (line.indexOf('SOURCE ') === 0) {
      var src = line.slice(7).trim();
      this.kv.generic_input_source = src;
      this._emitLine('OK');
      // echo back the new source as a VAL so store stays in sync
      this._emitLine('VAL generic_input_source ' + src);
      return;
    }
    // unknown -> ack like real backend
    this._emitLine('OK');
  };

  // ---- dev-panel injection API (fake flow_control pushing to web_ui) ----
  MockTransport.prototype.pushNav = function (act) { this._emitLine('NAV ' + act); };
  MockTransport.prototype.pushVal = function (k, v) {
    this.kv[k] = String(v);
    this._emitLine('VAL ' + k + ' ' + v);
  };
  MockTransport.prototype.setNoSignal = function (flag) {
    this._emitLine('VAL no_signal ' + (flag ? 'true' : 'false'));
    // shell listens for no_signal via its own hook; we also drive it directly
    if (global.Shell && typeof global.Shell.setNoSignal === 'function') {
      global.Shell.setNoSignal(!!flag);
    }
  };
  MockTransport.prototype.signalLock = function () {
    // signal locked -> external source is now displayable (clears black/no-signal)
    this._emitLine('VAL signal_lock true');
    if (global.Shell && typeof global.Shell.setNoSignal === 'function') {
      global.Shell.setNoSignal(false);
    }
  };

  // USB device simulation
  MockTransport.prototype.insertUsb = function (deviceName, deviceId) {
    var devices = [];
    try {
      if (this.kv['usb_device_list']) {
        devices = JSON.parse(this.kv['usb_device_list']);
      }
    } catch (e) { devices = []; }

    var newDevice = {
      id: deviceId || 'usb_' + Date.now(),
      name: deviceName || 'USB Storage Device',
      label: deviceName || 'USB Storage Device'
    };
    devices.push(newDevice);
    this.kv['usb_device_list'] = JSON.stringify(devices);
    this._emitLine('VAL usb_device_list ' + this.kv['usb_device_list']);
    return newDevice;
  };

  MockTransport.prototype.removeUsb = function (deviceId) {
    var devices = [];
    try {
      if (this.kv['usb_device_list']) {
        devices = JSON.parse(this.kv['usb_device_list']);
      }
    } catch (e) { devices = []; }

    if (deviceId) {
      devices = devices.filter(function(d) { return d.id !== deviceId; });
    } else {
      devices = [];
    }
    this.kv['usb_device_list'] = JSON.stringify(devices);
    this._emitLine('VAL usb_device_list ' + this.kv['usb_device_list']);
  };

  MockTransport.prototype.getUsbDevices = function () {
    try {
      return JSON.parse(this.kv['usb_device_list'] || '[]');
    } catch (e) { return []; }
  };

  global.MockTransport = MockTransport;
  if (typeof module !== 'undefined' && module.exports) module.exports = MockTransport;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
