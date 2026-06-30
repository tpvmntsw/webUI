/**
 * MT9676 Signage WebUI — Factory Menu Screen (v6)
 * 整合原 factory.html 結構、factory.css 樣式與數據驅動控制邏輯
 * 修正版：完美相容 實體鍵盤 與 DEV PANEL 模擬器按鈕觸發
 */
(function () {
  'use strict';

  // --- 靜態資料結構 ---
  const AD_DATA = [
    { mode: "RGB", vals: ["1503","1499","1495","0","0","0","0"] },
    { mode: "PC",  vals: ["1503","1499","1495","0","0","0","0"] },
    { mode: "YPbPr(SD)", vals: ["1156","1130","1156","1024","128","1024","0"] },
    { mode: "YPbPr(HD)", vals: ["1156","1130","1156","1024","128","1024","0"] },
    { mode: "SCART", vals: ["1024","1024","1024","128","128","128","179"] }
  ];

  const WB_DATA = [
    { ct: "12000 K", vals: ["109","117","127","1024","1024","1024"] },
    { ct: "6500 K",  vals: ["127","126","112","1024","1024","1024"] },
    { ct: "9300 K",  vals: ["119","127","127","1024","1024","1024"] }
  ];

  const SOURCE_LIST = ["VGA", "HDMI 1", "HDMI 2", "HDMI 3"];
  const PIC_MODE_LIST = ["Standard", "Cinema", "Dynamic", "sports"];
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const ADJUST_BOUNDS = {
    DEFAULT: { MIN: 0, MAX: 2047, STEP: 1 },
    MODULATION: { MIN: 0, MAX: 100, STEP: 1 },
    PERCENTAGE: { MIN: 0, MAX: 100, STEP: 0.05 },
    PANEL_SWING: { MIN: 100, MAX: 1000, STEP: 10 },
    PANEL_ID: { MIN: 0, MAX: 29, STEP: 1 }
  };

  // --- 內部元件引用與狀態暫存 ---
  let containerEl = null;
  let sourceIdx = 0;
  let picModeIdx = 0;
  let adIdx = 0;
  let wbIdx = 0;

  let currentStep = 'idle';
  let cloneStep = 'idle';
  let cloneTypeIdx = 0;
  let cloneConfirmIdx = 0;

  // 暗號緩衝區與目標序列
  let sequenceBuffer = [];
  const TARGET_SEQ = ['MENU', '1', '9', '9', '9'];
  let lastKeyTime = Date.now();

  // 統一的緩衝處理核心函式
  function processIncomingKey(keyToken) {
    const now = Date.now();
    // 兩次按鍵超過 1.5 秒自動重設
    if (now - lastKeyTime > 1500) {
      sequenceBuffer = [];
    }
    lastKeyTime = now;

    // 將收到的 key token 標準化（大寫）
    const token = String(keyToken).toUpperCase();

    if (['MENU', '1', '9'].includes(token)) {
      sequenceBuffer.push(token);
    }

    if (sequenceBuffer.length > TARGET_SEQ.length) {
      sequenceBuffer.shift();
    }

    // 比對密碼是否正確
    if (JSON.stringify(sequenceBuffer) === JSON.stringify(TARGET_SEQ)) {
      sequenceBuffer = []; // 觸發後清空
      console.log("[Factory] Unlock Password Matched! Displaying Factory UI...");
      Shell.show('factory-menu');
    }
  }

  // ==========================================================================
  // 管道 A：監聽實體鍵盤 (網頁背景按下實體鍵盤時觸發)
  // ==========================================================================
  window.addEventListener('keydown', function (event) {
    if (typeof Shell !== 'undefined' && !Shell.isActive('factory-menu')) {
      let pressedKey = event.key;
      if (event.keyCode === 182 || event.keyCode === 82 || event.keyCode === 77 || pressedKey === 'Menu') {
        pressedKey = 'MENU';
      }
      processIncomingKey(pressedKey);
    }
  });

  // --- 輔助函式：切換子選單/視窗顯示狀態 ---
  function toggleSubElement(id, show) {
    if (!containerEl) return;
    const el = containerEl.querySelector('#' + id);
    if (!el) return;
    if (show) {
      el.classList.remove('hidden');
      el.classList.add(id.includes('dialog') && !id.includes('bar') ? 'visible' : 'visible-block');
    } else {
      el.classList.remove('visible', 'visible-block');
      el.classList.add('hidden');
    }
  }

  function switchSubMenu(targetId) {
    if (!containerEl) return;
    containerEl.querySelectorAll('.menu-container').forEach(m => {
      m.classList.remove('visible-block');
      m.classList.add('hidden');
    });
    const targetMenu = containerEl.querySelector('#' + targetId);
    if (targetMenu) {
      targetMenu.classList.remove('hidden');
      targetMenu.classList.add('visible-block');
      resetFocus(targetMenu);
    }
    if (targetId === 'info-menu') updateTime();
  }

  function resetFocus(menuNode) {
    menuNode.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    const firstItem = menuNode.querySelector('.menu-item');
    if (firstItem) firstItem.classList.add('active');
  }

  function updateTime() {
    if (!containerEl) return;
    const n = new Date();
    const timeStr = `${MONTHS[n.getMonth()]} ${String(n.getDate()).padStart(2,'0')} ${n.getFullYear()}, ${n.toTimeString().split(' ')[0]}`;
    const el = containerEl.querySelector('#info-buildtime');
    if (el) el.innerText = timeStr;
  }

  function syncAd() {
    if (!containerEl) return;
    const row = AD_DATA[adIdx];
    containerEl.querySelector('#mode-val').innerText = row.mode;
    const vals = containerEl.querySelectorAll('#sub-menu .val');
    row.vals.forEach((v, i) => {
      if (vals[i + 2]) vals[i + 2].innerText = v;
    });
  }

  function syncWb() {
    if (!containerEl) return;
    const row = WB_DATA[wbIdx];
    containerEl.querySelector('#ct-val').innerText = row.ct;
    const vals = containerEl.querySelectorAll('#wb-menu .val');
    row.vals.forEach((v, i) => {
      if (vals[i + 1]) vals[i + 1].innerText = v;
    });
  }

  function updateModelType(panelId) {
    if (!containerEl) return;
    const typeEl = containerEl.querySelector('#model-type-val');
    if (!typeEl) return;
    const isWW = (panelId >= 0 && panelId <= 5) || (panelId >= 12 && panelId <= 13) || (panelId >= 21 && panelId <= 29);
    typeEl.innerText = isWW ? "WW" : "JP";
  }

  function showCloneType() {
    cloneStep = 'type';
    cloneTypeIdx = 0;
    updateCloneTypeHighlight();
    toggleSubElement('clone-type-dialog', true);
  }

  function updateCloneTypeHighlight() {
    if (!containerEl) return;
    const opts = containerEl.querySelectorAll('#clone-type-options .clone-option');
    opts.forEach((o, i) => o.classList.toggle('active', i === cloneTypeIdx));
  }

  function showCloneConfirm() {
    cloneStep = 'confirm';
    cloneConfirmIdx = 0;
    const titleEl = containerEl.querySelector('#clone-confirm-title');
    const subtitleEl = containerEl.querySelector('#clone-confirm-subtitle');

    if (cloneTypeIdx === 0) {
      titleEl.innerText = "Data to USB memory";
      subtitleEl.innerText = "The data will be overwritten when any data exists originally. Are you OK to write the data ?";
    } else {
      titleEl.innerText = "Data from USB memory";
      subtitleEl.innerText = "Do you copy the data ?";
    }
    updateCloneConfirmHighlight();
    toggleSubElement('clone-type-dialog', false);
    toggleSubElement('clone-confirm-dialog', true);
  }

  function updateCloneConfirmHighlight() {
    if (!containerEl) return;
    containerEl.querySelector('#clone-yes').classList.toggle('active', cloneConfirmIdx === 0);
    containerEl.querySelector('#clone-no').classList.toggle('active', cloneConfirmIdx === 1);
  }

  function closeClone() {
    cloneStep = 'idle';
    toggleSubElement('clone-type-dialog', false);
    toggleSubElement('clone-confirm-dialog', false);
    toggleSubElement('clone-processing-dialog', false);
  }

  function runCloneProcessing() {
    cloneStep = 'processing';
    const statusMsg = containerEl.querySelector('#clone-status-msg');
    toggleSubElement('clone-confirm-dialog', false);
    toggleSubElement('clone-processing-dialog', true);
    statusMsg.innerHTML = "DO NOT unplug your Display!<br>Cloning in progress, please wait.";

    setTimeout(() => {
      if (cloneTypeIdx === 0) {
        statusMsg.innerText = "Data copy finished.";
        setTimeout(() => { closeClone(); }, 2000);
      } else {
        statusMsg.innerHTML = "Cloning finished.<br>Please turn off the main power.";
      }
    }, 5000);
  }

  function triggerProcessing() {
    toggleSubElement('processing-dialog', true);
    setTimeout(() => { toggleSubElement('processing-dialog', false); }, 1500);
  }

  function startFactoryReset() {
    currentStep = 'resetting';
    toggleSubElement('reset-dialog', true);
    const timerEl = containerEl.querySelector('#reset-timer');
    let timeLeft = 10;
    timerEl.innerText = timeLeft;

    const countdown = setInterval(() => {
      timeLeft--;
      timerEl.innerText = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(countdown);
        Shell.selectSource('HOME');
        Shell.hide('factory-menu');
      }
    }, 1000);
  }

  function startUpdate(isSuccess = true) {
    currentStep = 'updating';
    const msg = containerEl.querySelector('#update-msg');
    const nav = containerEl.querySelector('#update-nav');
    toggleSubElement('update-dialog', true);
    msg.innerText = "Detecting software file...";
    nav.classList.replace('visible', 'hidden');

    setTimeout(() => {
      if (isSuccess) {
        msg.innerText = "SoftwareUpdate(USB)";
        nav.classList.replace('hidden', 'visible');
        currentStep = 'confirm';
      } else {
        msg.innerText = "Can't Detect software file!";
        setTimeout(() => {
          toggleSubElement('update-dialog', false);
          currentStep = 'idle';
        }, 2000);
      }
    }, 1500);
  }

  function runProgressBar() {
    currentStep = 'progress';
    containerEl.querySelector('#update-nav').classList.replace('visible', 'hidden');
    const prog = containerEl.querySelector('#update-progress');
    prog.classList.replace('hidden', 'visible-block');

    let p = 0;
    const inv = setInterval(() => {
      p += 2;
      prog.innerText = p + " %";
      if (p >= 100) {
        clearInterval(inv);
        setTimeout(() => {
          toggleSubElement('update-dialog', false);
          prog.classList.replace('visible-block', 'hidden');
          currentStep = 'idle';
        }, 1000);
      }
    }, 50);
  }

  function showBar(li) {
    const labelNode = li.querySelector('span:first-child');
    if (!labelNode) return;
    containerEl.querySelector('#modal-label').innerText = labelNode.innerText;
    containerEl.querySelector('#modal-status').innerText = li.querySelector('.val').innerText;
    toggleSubElement('tune-modal', true);
  }

  function handleAdjust(dir) {
    const activeMenu = containerEl.querySelector('.menu-container.visible-block');
    const li = activeMenu.querySelector('.menu-item.active');
    const label = li.querySelector('span:first-child').innerText;
    const valEl = li.querySelector('.val');
    const type = li.getAttribute('data-type');
    const unit = li.getAttribute('data-unit') || "";

    if (label === "MODE") {
      adIdx = (adIdx + dir + AD_DATA.length) % AD_DATA.length;
      syncAd();
    } else if (label === "Color Temperature") {
      wbIdx = (wbIdx + dir + WB_DATA.length) % WB_DATA.length;
      syncWb();
    } else if (label === "Source") {
      sourceIdx = (sourceIdx + dir + SOURCE_LIST.length) % SOURCE_LIST.length;
      valEl.innerText = SOURCE_LIST[sourceIdx];
      if (SOURCE_LIST[sourceIdx] === "VGA") triggerProcessing();
    } else if (label === "Picture mode" && activeMenu.id === "pic-menu") {
      picModeIdx = (picModeIdx + dir + PIC_MODE_LIST.length) % PIC_MODE_LIST.length;
      valEl.innerText = PIC_MODE_LIST[picModeIdx];
    } else if (label === "PANEL ID") {
      let v = parseInt(valEl.innerText) || 0;
      v = Math.max(ADJUST_BOUNDS.PANEL_ID.MIN, Math.min(ADJUST_BOUNDS.PANEL_ID.MAX, v + dir));
      valEl.innerText = v;
      updateModelType(v);
    } else if (type === 'toggle-num') {
      valEl.innerText = valEl.innerText === "1" ? "0" : "1";
    } else if (type === 'action') {
      valEl.innerText = valEl.innerText === "Off" ? "On" : "Off";
    } else if (type === 'adjust') {
      let rawVal = valEl.innerText.replace(unit, "");
      let v = parseFloat(rawVal) || 0;

      let conf = ADJUST_BOUNDS.DEFAULT;
      if (label.includes("Percentage")) conf = ADJUST_BOUNDS.PERCENTAGE;
      else if (label.includes("Modulation")) conf = ADJUST_BOUNDS.MODULATION;
      else if (label === "Panel Swing") conf = ADJUST_BOUNDS.PANEL_SWING;

      v = Math.max(conf.MIN, Math.min(conf.MAX, v + (dir * conf.STEP)));
      valEl.innerText = (conf.STEP < 1 ? v.toFixed(2) : Math.round(v)) + unit;
    }

    if (containerEl.querySelector('#tune-modal').classList.contains('visible')) {
      containerEl.querySelector('#modal-status').innerText = valEl.innerText;
    }
  }

  function handleCloneKeyStep(key) {
    if (cloneStep === 'processing') return;
    if (cloneStep === 'type') {
      if (key === 'DOWN' || key === 'UP') {
        cloneTypeIdx = (cloneTypeIdx + (key === 'DOWN' ? 1 : -1) + 2) % 2;
        updateCloneTypeHighlight();
      } else if (key === 'RIGHT' || key === 'OK') {
        showCloneConfirm();
      } else if (key === 'BACK') {
        closeClone();
      }
    } else if (cloneStep === 'confirm') {
      if (key === 'LEFT' || key === 'RIGHT' || key === 'DOWN' || key === 'UP') {
        cloneConfirmIdx = cloneConfirmIdx === 0 ? 1 : 0;
        updateCloneConfirmHighlight();
      } else if (key === 'OK' || key === 'RIGHT') {
        if (cloneConfirmIdx === 0) runCloneProcessing();
        else closeClone();
      } else if (key === 'BACK') {
        toggleSubElement('clone-confirm-dialog', false);
        showCloneType();
      }
    }
  }

  function handleUpdateKeyStep(key) {
    if (currentStep === 'confirm') {
      if (key === 'LEFT') runProgressBar();
      else if (key === 'RIGHT' || key === 'BACK') {
        toggleSubElement('update-dialog', false);
        currentStep = 'idle';
      }
    }
  }

  // ==========================================
  // 核心 有序層級 Shell 註冊宣告
  // ==========================================
  Shell.register({
    id: 'factory-menu',
    layer: 'factory',

    // ==========================================================================
    // 管道 B：接通 DEV PANEL (點擊右下角網頁按鈕時，由 Shell 拋入字串事件)
    // onNavGlobal 會在所有 NAV 事件時被呼叫（不管 factory-menu 是否在最上層）
    // ==========================================================================
    onNavGlobal: function (act) {
      if (!Shell.isActive('factory-menu')) {
        processIncomingKey(act);
      }
    },

    mount: function (el) {
      containerEl = el;

      const style = document.createElement('style');
      style.textContent = `
        .screen-factory-menu { position: absolute; inset: 0; pointer-events: auto; }
        .screen-factory-menu .hidden { display: none !important; }
        .screen-factory-menu .visible { display: flex !important; }
        .screen-factory-menu .visible-block { display: block !important; }

        .screen-factory-menu .menu-container {
            position: absolute; top: 20px; left: 20px;
            background-color: #0080ff !important; width: 400px; height: 700px;
            padding: 20px; color: #a0c8f0; box-shadow: 0 0 20px #000;
            box-sizing: border-box; font-family: Arial; z-index: 100;
        }
        .screen-factory-menu .menu-title { text-align: center; font-size: 18px; margin-bottom: 25px; margin-top:0; color:#fff; }
        .screen-factory-menu .menu-list { list-style: none; padding: 0; margin: 0; }
        .screen-factory-menu .menu-item {
            padding: 8px 12px; font-size: 16px; font-weight: bold;
            margin-bottom: 4px; border: 2px solid transparent; cursor: pointer;
            display: flex; justify-content: flex-start;
        }
        .screen-factory-menu .sub-item { justify-content: space-between; }
        .screen-factory-menu .menu-item.active { border: 2px solid #efc91c !important; color: #fff !important; background-color: transparent !important; }
        .screen-factory-menu .val { color: #a0c8f0; }

        .screen-factory-menu .tune-bar {
            position: absolute; top: 800px; left: 20px;
            background-color: #b5db08 !important; width: 400px; height: 50px;
            display: flex; justify-content: space-between; align-items: center;
            padding: 0 20px; box-shadow: 0 0 15px rgba(0,0,0,0.5); z-index: 200;
            box-sizing: border-box;
        }
        .screen-factory-menu .tune-label, .screen-factory-menu .tune-status { color: #333 !important; font-size: 24px; font-weight: bold; }
        .screen-factory-menu .arrow { width: 0; height: 0; border-top: 15px solid transparent; border-bottom: 15px solid transparent; }
        .screen-factory-menu .left-arrow  { border-right: 20px solid #b2b2b2; }
        .screen-factory-menu .right-arrow { border-left: 20px solid #b2b2b2; }
        .screen-factory-menu .version-info { position: absolute; bottom: 20px; left: 20px; font-size: 13px; color: #888; }

        .screen-factory-menu .msg-box {
            position: absolute; top: 20px; right: 20px; width: 450px; height: 250px;
            background-color: #717171 !important; border-top: 35px solid #344a77; border-bottom: 25px solid #717171;
            color: white; flex-direction: column; justify-content: center; align-items: center; z-index: 1000;
            box-shadow: 10px 10px 20px rgba(0,0,0,0.5); box-sizing: border-box;
        }
        .screen-factory-menu .update-title { font-size: 22px; margin-bottom: 15px; font-weight: bold; text-align: center; padding: 0 10px; }
        .screen-factory-menu .update-footer { position: absolute; bottom: 5px; width: 100%; display: flex; justify-content: space-between; padding: 0 30px; box-sizing: border-box; font-size: 18px; font-weight: bold; }
        .screen-factory-menu .processing-text { font-size: 22px; font-weight: bold; letter-spacing: 2px; text-align: center; }
        .screen-factory-menu .reset-countdown { font-size: 48px; color: #f2bc44; margin-top: 10px; }

        .screen-factory-menu .clone-dialog { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: #121212 !important; display: none; justify-content: center; align-items: center; z-index: 2000; }
        .screen-factory-menu .clone-window { width: 800px; height: 400px; background-color: #717171 !important; border: 1px solid #000; box-shadow: 0 20px 50px rgba(0,0,0,0.6); display: flex; flex-direction: column; align-items: center; color: #fff; position: relative; box-sizing: border-box; }
        .screen-factory-menu .clone-title { font-size: 20px; font-weight: bold; margin-top: 40px; margin-bottom: 40px; text-align: center; }
        .screen-factory-menu .clone-subtitle { width: 80%; margin: 40px auto; line-height: 1.6; text-align: center; font-size: 22px; color: white; white-space: pre-line; }
        .screen-factory-menu .clone-options { list-style: none; padding: 0; margin: 0; width: 100%; display: flex; flex-direction: column; align-items: center; }
        .screen-factory-menu .clone-option { width: 700px; padding: 12px 10px; font-size: 20px; font-weight: bold; margin-bottom: 8px; cursor: pointer; display: flex; align-items: center; justify-content: flex-start; color: #ccc; background-color: transparent; box-sizing: border-box; }
        .screen-factory-menu .clone-option.active { background-color: #FFC239 !important; color: #000 !important; }
        .screen-factory-menu .clone-arrow { width: 0; height: 0; border-top: 8px solid transparent; border-bottom: 8px solid transparent; border-left: 12px solid #FFF; display: none; margin-left: 25px; }
        .screen-factory-menu .clone-option.active .clone-arrow { display: inline-block; }
        .screen-factory-menu .clone-btns { position: absolute; bottom: 40px; left: 0; width: 100%; display: flex; justify-content: center; gap: 40px; }
        .screen-factory-menu .clone-btn { padding: 10px 50px; font-size: 20px; font-weight: bold; cursor: pointer; color: #ccc; background-color: transparent; border: none; display: flex; align-items: center; }
        .screen-factory-menu .clone-btn.active { background-color: #FFC239 !important; color: #000 !important; }
        .screen-factory-menu .clone-btn .clone-arrow { display: none !important; }
      `;
      document.head.appendChild(style);

      el.innerHTML = `
        <div class="menu-container visible-block" id="main-menu">
            <h2 class="menu-title">Factory Setting</h2>
            <ul class="menu-list">
                <li class="menu-item active" data-target="sub-menu">ADCADJUST</li>
                <li class="menu-item" data-target="pic-menu">Picture mode</li>
                <li class="menu-item" data-target="wb-menu">Whitebalance</li>
                <li class="menu-item" data-target="ssc-menu">SSC</li>
                <li class="menu-item" data-target="spec-menu">SPECIALSET</li>
                <li class="menu-item" data-target="info-menu">Info.</li>
                <li class="menu-item" data-action="update">SoftwareUpdate(USB)</li>
                <li class="menu-item" data-action="clone">USB data cloning</li>
                <li class="menu-item" data-action="factory-reset">FACTORY RESET</li>
                <li class="menu-item" data-action="exit">EXIT</li>
            </ul>
            <div class="version-info">BD_715GF621</div>
        </div>

        <div class="menu-container hidden" id="ssc-menu">
            <h2 class="menu-title">SSC</h2>
            <ul class="menu-list">
                <li class="menu-item sub-item" data-type="adjust"><span>MIUEnable</span><span class="val">1</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>MIU Modulation(Khz)</span><span class="val">30</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>MIU Percentage(%)</span><span class="val">1</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>LVDSEnable</span><span class="val">1</span></li>
                <li class="menu-item sub-item" data-type="adjust" data-unit=" KHz"><span>LVDS Modulation(Khz)</span><span class="val">30.0 KHz</span></li>
                <li class="menu-item sub-item" data-type="adjust" data-unit=" %"><span>LVDS Percentage(%)</span><span class="val">0.15 %</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>Panel Swing</span><span class="val">350</span></li>
            </ul>
        </div>

        <div class="menu-container hidden" id="spec-menu">
            <h2 class="menu-title">SPECIALSET</h2>
            <ul class="menu-list">
                <li class="menu-item sub-item active" data-type="adjust"><span>PANEL ID</span><span class="val" id="panel-id-val">0</span></li>
                <li class="menu-item sub-item"><span>MODEL TYPE</span><span class="val" id="model-type-val">WW</span></li>
                <li class="menu-item sub-item" data-type="action"><span>ANTI-POPNOISE</span><span class="val">Off</span></li>
                <li class="menu-item sub-item" data-type="action"><span>WHITEPATTERN</span><span class="val">Off</span></li>
                <li class="menu-item sub-item" data-type="action"><span>W7500 MAC MODE</span><span class="val">Off</span></li>
                <li class="menu-item sub-item" data-type="action"><span>VGA WP MODE</span><span class="val">On</span></li>
                <li class="menu-item sub-item" data-type="action"><span>THERMAL MODE</span><span class="val">On</span></li>
                <li class="menu-item sub-item" data-type="action"><span>AGING MODE</span><span class="val">Off</span></li>
                <li class="menu-item sub-item" data-type="action"><span>DEBUG MODE</span><span class="val">Off</span></li>
                <li class="menu-item sub-item" data-type="action-silent"><span>EEPROM INIT</span><span class="val"></span></li>
                <li class="menu-item sub-item" data-type="action"><span>NS recovery</span><span class="val">Off</span></li>
            </ul>
        </div>

        <div class="menu-container hidden" id="pic-menu">
            <h2 class="menu-title">Picture mode</h2>
            <ul class="menu-list">
                <li class="menu-item sub-item active" data-type="toggle"><span>Source</span><span class="val" id="source-val">VGA</span></li>
                <li class="menu-item sub-item" data-type="toggle"><span>Picture mode</span><span class="val" id="picmode-val">Standard</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>Brightness</span><span class="val">50</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>Contrast</span><span class="val">50</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>Color</span><span class="val">50</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>Sharpness</span><span class="val">0</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>Tint</span><span class="val">50</span></li>
                <li class="menu-item sub-item" data-action-silent="copy"><span>COPY ALL</span><span class="val"></span></li>
            </ul>
        </div>

        <div class="menu-container hidden" id="sub-menu">
            <h2 class="menu-title">ADCADJUST</h2>
            <ul class="menu-list">
                <li class="menu-item sub-item active" data-type="toggle"><span>MODE</span><span class="val" id="mode-val">RGB</span></li>
                <li class="menu-item sub-item" data-type="action"><span>ADCTune</span><span class="val">Fail</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>R-GAIN</span><span class="val">1503</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>G-GAIN</span><span class="val">1499</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>B-GAIN</span><span class="val">1495</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>R-OFFSET</span><span class="val">0</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>G-OFFSET</span><span class="val">0</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>B-OFFSET</span><span class="val">0</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>ADC Phase</span><span class="val">0</span></li>
            </ul>
        </div>

        <div class="menu-container hidden" id="wb-menu">
            <h2 class="menu-title">Whitebalance</h2>
            <ul class="menu-list">
                <li class="menu-item sub-item active" data-type="toggle"><span>Color Temperature</span><span class="val" id="ct-val">12000 K</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>R-GAIN</span><span class="val">109</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>G-GAIN</span><span class="val">117</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>B-GAIN</span><span class="val">127</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>R-OFFSET</span><span class="val">1024</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>G-OFFSET</span><span class="val">1024</span></li>
                <li class="menu-item sub-item" data-type="adjust"><span>B-OFFSET</span><span class="val">1024</span></li>
                <li class="menu-item sub-item" data-type="action"><span>WHITEPATTERN</span><span class="val">Off</span></li>
            </ul>
        </div>

        <div class="menu-container hidden" id="info-menu">
            <h2 class="menu-title">Info.</h2>
            <ul class="menu-list">
                <li class="menu-item sub-item active"><span>BUILDTIME</span><span class="val" id="info-buildtime"></span></li>
                <li class="menu-item sub-item"><span>Board</span><span class="val">BD_715GF621</span></li>
                <li class="menu-item sub-item"><span>panel</span><span class="val">TPP430WR</span></li>
                <li class="menu-item sub-item"><span>BL COUNT</span><span class="val">0</span></li>
                <li class="menu-item sub-item"><span>THERMAL</span><span class="val">+32</span></li>
                <li class="menu-item sub-item"><span>LAN VERSION</span><span class="val">1.15</span></li>
                <li class="menu-item sub-item"><span>MAIN</span><span class="val">Ver1.505</span></li>
                <li class="menu-item sub-item"><span>MAC SYNC</span><span class="val">Sync=Y</span></li>
                <li class="menu-item sub-item"><span>MAC ADDRESS</span><span class="val">4C:36:4E:CD:3C:3D</span></li>
                <li class="menu-item sub-item"><span>LockN Fail</span><span class="val">0</span></li>
            </ul>
        </div>

        <div id="processing-dialog" class="msg-box hidden"><div class="processing-text">Processing...</div></div>

        <div id="reset-dialog" class="msg-box hidden">
            <div class="processing-text">FACTORY RESET...<br>System will restart in</div>
            <div id="reset-timer" class="reset-countdown">10</div>
        </div>

        <div id="update-dialog" class="msg-box hidden">
            <div id="update-msg" class="update-title">Detecting...</div>
            <div id="update-progress" class="hidden" style="font-size: 36px;">0 %</div>
            <div id="update-nav" class="update-footer hidden"><span>◀ Yes</span><span>No ▶</span></div>
        </div>

        <div id="tune-modal" class="tune-bar hidden">
            <div class="arrow left-arrow">◀ </div>
            <span class="tune-label" id="modal-label"></span>
            <span class="tune-status" id="modal-status"></span>
            <div class="arrow right-arrow"> ▶</div>
        </div>

        <div id="clone-type-dialog" class="clone-dialog hidden">
            <div class="clone-window">
                <div class="clone-title">Select copy type</div>
                <ul class="clone-options" id="clone-type-options">
                    <li class="clone-option active"><span>Display → USB memory <div class="clone-arrow"></div></span></li>
                    <li class="clone-option"><span>USB memory → Display <div class="clone-arrow"></div></span></li>
                </ul>
            </div>
        </div>

        <div id="clone-confirm-dialog" class="clone-dialog hidden">
            <div class="clone-window">
                <div class="clone-title" id="clone-confirm-title">Data from Display</div>
                <div class="clone-subtitle" id="clone-confirm-subtitle">Do you copy the data?</div>
                <div class="clone-btns">
                    <div class="clone-btn active" id="clone-yes"><span>Yes</span></div>
                    <div class="clone-btn" id="clone-no"><span>No</span></div>
                </div>
            </div>
        </div>

        <div id="clone-processing-dialog" class="clone-dialog hidden">
            <div class="clone-window">
                <div id="clone-status-msg" class="clone-subtitle" style="margin-top: 80px; font-size: 22px;"></div>
            </div>
        </div>
      `;
    },

    onShow: function () {
      switchSubMenu('main-menu');
      syncAd();
      syncWb();
      updateTime();
      currentStep = 'idle';
      cloneStep = 'idle';
    },

    onHide: function () {
      sequenceBuffer = [];
    },

    onNav: function (act) {
      // 選單顯示後的內部操作導覽
      if (currentStep !== 'idle') {
        handleUpdateKeyStep(act);
        return true;
      }

      if (cloneStep !== 'idle') {
        handleCloneKeyStep(act);
        return true;
      }

      const tuneModal = containerEl ? containerEl.querySelector('#tune-modal') : null;
      if (tuneModal && (tuneModal.classList.contains('visible-block') || tuneModal.classList.contains('visible'))) {
        if (act === 'BACK' || act === 'OK') {
          toggleSubElement('tune-modal', false);
        } else if (act === 'RIGHT') {
          handleAdjust(1);
        } else if (act === 'LEFT') {
          handleAdjust(-1);
        }
        return true;
      }

      const activeMenu = containerEl ? Array.from(containerEl.querySelectorAll('.menu-container')).find(m => m.classList.contains('visible-block')) : null;
      if (!activeMenu) return false;

      const items = Array.from(activeMenu.querySelectorAll('.menu-item'));
      let idx = items.findIndex(el => el.classList.contains('active'));

      if (act === 'DOWN' || act === 'UP') {
        items[idx].classList.remove('active');
        idx = (idx + (act === 'DOWN' ? 1 : -1) + items.length) % items.length;
        items[idx].classList.add('active');
        return true;
      }

      if (act === 'OK' || act === 'RIGHT') {
        const target = items[idx].getAttribute('data-target');
        const action = items[idx].getAttribute('data-action');
        const type = items[idx].getAttribute('data-type');

        if (target) {
          switchSubMenu(target);
        } else if (action === 'update') {
          startUpdate(act === 'OK');
        } else if (action === 'factory-reset') {
          startFactoryReset();
        } else if (action === 'clone') {
          showCloneType();
        } else if (action === 'exit') {
          Shell.hide('factory-menu');
        } else if (type === 'action-silent') {
          const valEl = items[idx].querySelector('.val');
          if (valEl) valEl.innerText = "";
        } else if (activeMenu.id !== 'main-menu') {
          if (type === 'toggle' || type === 'toggle-num') handleAdjust(1);
          else if (type === 'adjust' || type === 'action') showBar(items[idx]);
        }
        return true;
      }

      if (act === 'LEFT' && activeMenu.id !== 'main-menu') {
        const type = items[idx].getAttribute('data-type');
        if (type === 'toggle' || type === 'toggle-num') {
          handleAdjust(-1);
        } else {
          switchSubMenu('main-menu');
        }
        return true;
      }

      if (act === 'BACK') {
        if (activeMenu.id !== 'main-menu') {
          switchSubMenu('main-menu');
          return true;
        }
        Shell.hide('factory-menu');
        return true;
      }

      return false;
    },

    onVal: function (key, value) {
      // 保留對接管道
    }
  });
})();
