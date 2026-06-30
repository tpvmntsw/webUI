# Quick Start — 一頁上手（v6）

> 完整說明見 `README.md`；新手教學見 `APP開發指南.md`；規格見 `../2026-06-22_webui-ui-spec_v6.md`。

## 跑起來
```
python -m http.server 8137
# 瀏覽器開 http://localhost:8137/        （預設 mock，右下角有 DEV PANEL）
```
DEV PANEL：按 NAV 鍵、切 no_signal、切源，即時看 overlay stack。

## 加一個畫面（3 步）
```
cp screens/_template.js screens/myscreen.js     # 1. 複製
# 2. 改 id / layer，實作 mount/onNav...（見下方速查）
# 3. index.html 加一行：<script src="screens/myscreen.js"></script>
```

## id 命名規範
**id ＝ 檔名去 `.js`，`<prefix>-<name>` 全小寫 kebab**。前綴 7 類：

| 前綴 | 大類 | 範例 |
|---|---|---|
| `source-` | 來源切換 | `source-menu` |
| `factory-` | 工廠功能 | `factory-menu` |
| `osd-` | OSD 主選單 | `osd-menu` |
| `info-` | 資訊顯示（唯讀） | `info-display`、`info-banner` |
| `audio-` | 音量/靜音 HUD | `audio-volume`、`audio-mute` |
| `sys-` | 系統/全屏狀態 | `sys-home`、`sys-nosignal`、`sys-blackout`、`sys-wizard` |
| `app-` | 內嵌應用畫面 | `app-usb`、`app-iwb` |

（`osd-` OSD 設定選單 ≠ `audio-` 音量/靜音 HUD，勿混。）

## screenDef 速查
```js
Shell.register({
  id: 'myscreen',                  // == 檔名去 .js，見上方前綴規範
  layer: 'osd-menu',               // v6：層級名（從 LAYER_ORDER 挑，不是數字）；大者蓋小者
  source: 'USB',                   // 選填：source-bound 不透明底層（綁某源、不由 NAV 叫出）
  timeout: 15000,                  // 選填，閒置 ms 自動關；省略=不自動關
  mount(el){ /* 建 DOM 一次，只碰自己的 el */ },
  onShow(p){}, onHide(){},
  onNav(act){ return false },      // true=吃掉這鍵；false=交給 shell 全域路由
  onVal(k,v){},                    // 收到 DB 值（Shell.store 已更新）
});
```

## 你會用到的 Shell API
| 呼叫 | 作用 |
|---|---|
| `Shell.show(id)` / `Shell.hide(id)` | 開 / 關自己的畫面 |
| `Shell.getLayerRank('osd-menu')` | 查某層級的名次（大者在上） |
| `Shell.store['generic_volume']` | 讀 DB 快取值 |
| `Shell.currentSource` | 當前來源 token |
| `Shell.selectSource('HDMI2')` | 切源（送 `SOURCE`） |
| `Shell.send('GET key')` | 向後端要值 |

## NAV act + 全域路由（onNav 回 false 時 shell 自動做）
`MENU`→`osd-menu` ｜ `SOURCE`→`source-menu` ｜ `BACK`→關最上層 ｜ `VOL+ VOL- MUTE`→`audio-volume` ｜ `DISPLAY`→`info-display` ｜ `UP DOWN LEFT RIGHT OK`→交給最上層畫面 ｜ 數字 `0-9`→組合鍵（Factory `Menu+1+9+9+9`）

## 層級表 LAYER_ORDER（v6 §2，低 → 高）
```
source.home < source.hdmi < source.usb < blackout < no-signal
< factory < setup-wizard < information < osd-menu < info-banner < volume
```
要調 z-order：搬動 `shell.js` 的 `LAYER_ORDER` 一個名字即可，畫面檔不用改。

## 別搬上板
`mock-transport.js`、`dev-panel.js`、`smoke-test.js` 只給開發用。上板只取 `shell.js` + `transport-ws.js` + `screens/*.js`。
