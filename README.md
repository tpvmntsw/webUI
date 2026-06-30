# MT9676 Signage WebUI — mock shell devkit (v6)

> **v6 重點**：z-order 不再用絕對數字。畫面宣告一個**層級名**（`layer:'osd-menu'`），由唯一一張有序表定義在 `Shell.LAYER_ORDER` 來決定誰蓋誰。要調順序只需變更列表，APP 畫面不需要改動。

---

## 檔案

| 檔案 | 用途 | APP開發者修改 |
|---|---|---|
| `index.html` | core shell host：載入 shell + transport + 所有 screens，黑底 `#stage` 容器 | 只需修改一行 |
| `shell.js` | 核心：`Shell.register` / 具名層級狀態機 / NAV·VAL 路由 / overlay stack / timeout / No Signal 再現 / 傳輸抽象 | 不要修改 |
| `transport-ws.js` | 真 WS（`ws://127.0.0.1:3000/web_ui`, subprotocol `signage`, 1s 重連） | 不要修改 |
| `mock-transport.js` | 瀏覽器內模擬 flow_control：kv 種子自 `db_list`、回應 DUMP/GET/SOURCE、可注入 VAL/NAV/no_signal | 可做開發輔助，但不要合回來 |
| `dev-panel.js` | 浮動控制台：送 NAV、切 no_signal/signal lock、切源、即時顯示 stack | 可做開發輔助，但不要合回來 |
| `screens/_template.js` | 有註解的範本，複製即開工 | 範例可自行開發，但不要合回來 |
| `screens/source-menu.js` | Source 選單（`layer:'osd-menu'`） | 不要修改 |
| `screens/app-usb.js` | USB Multi-Media Player 殼（source-bound 底層，`layer:'source.usb'`，§1.9 無功能殼） | 範例可自行開發，但不要合回來 |
| `smoke-test.js` | node 無頭狀態機驗證（26 項斷言，含 reorder 回歸） | 可做開發輔助，但不要合回來 |

---

## 怎麼跑

### 1. 瀏覽器


直接雙擊 `index.html` 就能跑（不需要 server）。建議用 Chrome 瀏覽器打開。

右下角會出現 **DEV PANEL**：可以按 NAV 鍵（MENU/SOURCE/方向鍵…）、切 no_signal、切來源，即時看到目前的 overlay stack。這就是你開發時的遙控器模擬器。


---

## 層級表（v6 §2.1）— z-order 的唯一來源

`shell.js` 裡的 `Shell.LAYER_ORDER`，**陣列順序即層級高低（後面＝高，蓋住前面）**：

```
低 ┌ source.home     Home / 透明 source（底層）
   │ source.hdmi     HDMI source 底層
   │ source.usb      USB source 底層（app-usb 綁這層）
   │ blackout        遮黑（切源中）
   │ no-signal       No Signal
   │ factory         Factory Menu
   │ setup-wizard    SetupWizard
   │ information      Information（Display 三段）
   │ osd-menu        OSD Menu / Source Menu
   │ info-banner     Info banner（切源後 toast）
高 └ volume          Volume / Mute
```

- 查自己的層級：`Shell.getLayerRank('osd-menu')` → 回名次（大者在上）。
- **要調 z-order**：把名字在 `LAYER_ORDER` 裡搬位置，畫面檔不用動。 APP 開發者可以不用管理順序。

---

## id 命名規範

**id ＝ 檔名去 `.js`，格式 `<prefix>-<name>`，全小寫 kebab**。選 prefix 看大類（7 類）：

| 前綴 | 大類 | id 範例 | 常用 layer |
|---|---|---|---|
| `source-` | 來源切換 | `source-menu` | `osd-menu` |
| `factory-` | 工廠功能 | `factory-menu` | `factory` |
| `osd-` | OSD 主選單（畫面/聲音/設定） | `osd-menu` | `osd-menu` |
| `info-` | 資訊顯示（唯讀） | `info-display`、`info-banner` | `information`、`info-banner` |
| `audio-` | 音量/靜音 HUD | `audio-volume`、`audio-mute` | `volume` |
| `sys-` | 系統/全屏狀態 | `sys-home`、`sys-nosignal`、`sys-blackout`、`sys-wizard` | `source.home`、`no-signal`、`blackout`、`setup-wizard` |
| `app-` | 內嵌應用畫面 | `app-usb`、`app-iwb` | `source.<token>` |

注意：`osd-`（OSD 主設定選單）與 `audio-`（音量/靜音 HUD）是不同大類，勿混。
**id 與 layer 是兩回事**：id 是檔案/畫面的唯一名；layer 是它在 z-order 表裡的位置名。多個畫面可共用同一 layer（如 `source-menu` 與未來的 `osd-menu` 都用 `osd-menu` 層）。

---

## 怎麼加一個新畫面（3 步）

1. **複製範本**：在 `screens` 目錄下建自己 APP 的目錄 `{app_name}`，複製範例 `cp screens/_template.js screens/{app_name}/<id>.js`。
2. **填 screenDef**：改 `id`、`layer`（從 `LAYER_ORDER` 挑一個名字，**不是數字**）、選填 `timeout`，實作 `mount/onShow/onHide/onNav/onVal`。只碰自己的 `el`，共享狀態讀 `Shell.store[...]` / `Shell.currentSource`，開關畫面用 `Shell.show(id)` / `Shell.hide(id)`，切源用 `Shell.selectSource(token)`。
3. **掛載**：在 `index.html` 的 screens 區加一行 `<script src="screens/<id>.js"></script>`。重整即生效。

`onNav` 回 `true` = 你吃掉這個按鍵；回 `false` = 交給 shell 做全域路由（`MENU`→`osd-menu`、`SOURCE`→`source-menu`、`BACK`→關最上層、`VOL±/MUTE`→`audio-volume`、`DISPLAY`→`info-display`）。

---

## Shell 契約（screenDef）

```js
Shell.register({
  id: 'audio-volume',              // 唯一字串
  layer: 'volume',                 // v6：層級名（從 Shell.LAYER_ORDER 挑），未知名稱會 throw
  // offset: 0,                    // 選填：私有子帶（同一 app 要多個 shell 級子畫面才用，預設 0）
  timeout: 15000,                  // 選填：閒置自動關閉 ms（省略=不自動關）；常數 Shell.DEFAULT_TIMEOUT=15000
  mount(el){},                     // 建 DOM 一次（el = 你的私有容器）
  onShow(params){},                // 每次顯示
  onHide(){},                      // 每次隱藏
  onNav(act){ return true/false }, // 處理一個 NAV act；true=已吃掉
  onVal(key,value){},              // 收到 VAL（Shell.store 已更新）
  source: 'USB',                   // 選填：source-bound 底層（見下）
});
```

shell 自帶的跨切面行為（畫面不用自己管）：
- **base layer**：`currentSource==='HOME'`→黑底；外部源→`html.transparent`（透明顯示底層）。
- **source-bound 底層**：screenDef 加 `source: '<TOKEN>'`（如 `'USB'`）+ 對應 `layer:'source.<token>'`，即把該畫面綁成那個 source 的**不透明底層內容**。切到該 token 時 shell 自動顯示為底層（z-index 0），onShow 收到 `{base:true}`；切離自動隱藏。它**不由 NAV 叫出**，永遠在所有 overlay 之下。範例見 `screens/app-usb.js`。
- **overlay stack 互斥**：只有最上層（層級最高）顯示，其餘隱藏。
- **No Signal 再現（§1.5）**：`no_signal:true` 且當前外部源→顯示 No Signal（`no-signal` 層）；被任何更高層 UI 蓋住暫隱，該 UI 關閉後過 `reshowMs`（預設 5000ms）自動再現；No Signal 顯示中 Back→暫隱 5s 後再現；直到 `no_signal:false`。No Signal 畫面本身之後由團隊做成 `screens/sys-nosignal.js`（id `no-signal`、`layer:'no-signal'`），shell 已支援其層級與再現邏輯（未註冊時改發 `no-signal-show` 事件）。
- **Back（§6）**：關最上層 overlay；全關完停在當前 source 底層態，**不切 source**。
- **timeout**：每畫面 `timeout` 到期自動 hide；任何 NAV 視為活動會重置計時。

---

## 怎麼合回


最終會取用：`shell.js` + `transport-ws.js` + 你們做好的 `screens/*.js`。而 `index.html` 會**移除** `mock-transport.js`、`dev-panel.js`，並把 transport 改走真 WS (websocket)。

**`mock-transport.js` / `dev-panel.js` / `smoke-test.js` 可供測試用**，你可以上面做開發輔助，但不要合回來。若認為有新增好用的功能給大家，請找 owner 討論後再合回。

---