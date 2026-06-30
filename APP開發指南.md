# MT9676 Signage WebUI — APP 開發指南（v6）

寫給要在這個 WebUI 上做一個畫面/功能的同事。看完你就能獨立做出一個畫面、在本機跑起來、最後合上。

---

## 1. 一句話：你要做什麼

整個 WebUI 是「**一個薄殼（shell）＋ 很多畫面（screens）**」。

- **shell**（`shell.js`）新竹負責維護：例如 z-order、按鍵路由、跟 WebSocket 建立通訊、開關畫面等。
- **每個畫面**＝一支 `screens/<id>.js`，由 APP 開發者寫。一個畫面就是一個功能：音量條、OSD 選單、Information 浮層、USB 播放器等。若需要與 websocket 溝通，待完成 websocket 架構後再自行於 websocket server 中添加 API 功能。

**你只要做一件事：複製範本 → 填一個 `Shell.register({...})` → 在 `index.html` 加一行。** 完成。

**注意事項：**

- 每個 APP **只能增加一行**；例如 `<script src="screens/source-menu.js"></script>`。若有多個 JS 檔案，請在 JS 中再另外 include，保持 `index.html` 整潔。
- 建立自己 APP 的資料夾 `screen/{app_name}/*.js` 下存放 JS 或其它檔案，不要與其它的 APP 及系統 shell 的檔案混在一起。
- 不要相互引用或修改不在自己 DOM 裡定義的函式及物件；各畫面的 DOM 需完全獨立。
- APP開發者需確保只能畫在自己的容器內。層級從 LAYER_ORDER 擇一名稱，不用自定編號。也不要覆寫、變更全域的 Z-order。
- 不要修改不在自己目錄下的檔案；如需修改請主動找各 owner 討論。

---

## 2. 畫面怎麼疊：兩種「疊」不要搞混

| 疊的層次 | 誰負責 | 怎麼控制 |
|---|---|---|
| **畫面 vs 畫面**（音量條蓋在 OSD 上？） | shell | 你宣告的 `layer` 名（見 §6） |
| **你畫面內部的物件互疊**（按鈕疊在縮圖上？） | APP owner | 普通 CSS `z-index`，關在你自己的 `el` 裡 |

重點：**你畫面內部怎麼疊就怎麼疊**（一般 HTML/CSS），shell 不管，APP 開發者只需確保畫在自己的容器內即可。shell 的層級**只決定畫面跟畫面之間**誰在上面。所以 APP 開發者不用煩惱 z-order，挑一個 `layer` 名稱就好。

---

## 3. 五分鐘跑起來

直接雙擊 `index.html` 就能跑（不需要 server）。建議用 Chrome 瀏覽器打開。

右下角會出現 **DEV PANEL**：可以按 NAV 鍵（MENU/SOURCE/方向鍵…）、切 no_signal、切來源，即時看到目前的 overlay stack。這就是你開發時的遙控器模擬器。


---

## 4. 做你的第一個畫面（逐步）

假設你要做「音量條」。

**第 1 步 — 複製範本**
```bash
cp screens/_template.js screens/audio-volume.js
```
（id 命名規範見 §5；音量/靜音用 `audio-` 前綴。）

**第 2 步 — 填 `Shell.register`**
```js
(function () {
  'use strict';
  var barEl = null;

  Shell.register({
    id: 'audio-volume',          // == 檔名去 .js
    layer: 'volume',             // 從層級表挑一個名字（§6），不是數字
    timeout: 15000,              // 15s 沒動作自動關（音量條規格）

    mount: function (el) {       // 只跑一次：把 DOM 建進你的私有容器 el
      el.innerHTML =
        '<div style="position:absolute;left:40px;bottom:40px;color:#fff;font:20px Arial">' +
        '🔊 <span class="vol-num">--</span></div>';
      barEl = el.querySelector('.vol-num');
    },

    onShow: function () {        // 每次顯示：從 Shell.store 取現值
      barEl.textContent = Shell.store['generic_volume'] || '0';
    },

    onNav: function (act) {      // 收到一個按鍵
      if (act === 'VOL+' || act === 'VOL-') {
        // ...更新音量、重畫；吃掉這個鍵
        return true;
      }
      return false;             // 其它鍵交給 shell 全域路由
    },

    onVal: function (key, value) {   // 後端推來新的 DB 值
      if (key === 'generic_volume' && barEl) barEl.textContent = value;
    }
  });
})();
```

**第 3 步 — 掛上去**
在 `index.html` 的 screens 區加一行：
```html
<script src="screens/audio-volume.js"></script>
```
重整瀏覽器。在 DEV PANEL 按 `VOL+`，你的音量條就會出現。完成。

---

## 5. id 命名規範（強制）

**id ＝ 檔名去 `.js`，格式 `<prefix>-<name>`，全小寫 kebab。** 前綴 7 類：

| 前綴 | 大類 | 範例 |
|---|---|---|
| `source-` | 來源切換 | `source-menu` |
| `factory-` | 工廠功能 | `factory-menu` |
| `osd-` | OSD 主選單（畫面/聲音/設定） | `osd-menu` |
| `info-` | 資訊顯示（唯讀） | `info-display`、`info-banner` |
| `audio-` | 音量/靜音 HUD | `audio-volume`、`audio-mute` |
| `sys-` | 系統/全屏狀態 | `sys-home`、`sys-nosignal`、`sys-blackout`、`sys-wizard` |
| `app-` | 內嵌應用畫面 | `app-usb`、`app-iwb` |

`osd-`（OSD 設定選單）與 `audio-`（音量 HUD）是**不同**大類，勿混。

---

## 6. 層級（z-order）

### 你不要寫死數字，挑「名字」即可

z-order 由一張**有序的具名表** `Shell.LAYER_ORDER` 決定（在 `shell.js` 裡）。陣列順序就是高低，**後面的蓋住前面的**：

```
低 ─ source.home ─ source.hdmi ─ source.usb ─ blackout ─ no-signal
   ─ factory ─ setup-wizard ─ information ─ osd-menu ─ info-banner ─ volume ─ 高
```

每個 APP 的畫面，都從這張表挑**一個名字**填進 `layer`。例如音量條挑 `'volume'`、OSD 選單挑 `'osd-menu'`、USB 播放器挑 `'source.usb'`。

### 查自己在哪一層
```js
Shell.getLayerRank('osd-menu');   // 回名次（整數，大者在上）
```
app 開發者用這個知道自己相對於別人在上或在下，**永遠看相對名次，不看絕對數字**。

### 為什麼是名字不是數字？
這樣**之後要調整 z-order，只要搬動那張表裡的一個名字，其它畫面檔不用改**。

畫面內部的物件互疊用 CSS 就可以。

---

## 7. 按鍵（NAV）與資料（VAL）

shell 從後端收兩種訊息，幫你轉成 callback：

- **NAV `<act>`**（遙控器/鍵鼠按鍵）→ 先給**最上層**畫面的 `onNav(act)`。
  - 回 `true` ＝「我吃掉了」，shell 不再處理。
  - 回 `false` ＝「我不要」，shell 做**全域路由**：

  | act | shell 全域動作 |
  |---|---|
  | `MENU` | 開 `osd-menu` |
  | `SOURCE` | 開 `source-menu` |
  | `BACK` | 關最上層 overlay |
  | `VOL+` / `VOL-` / `MUTE` | 開 `audio-volume` |
  | `DISPLAY` | 開 `info-display` |
  | `UP/DOWN/LEFT/RIGHT/OK` | 交給最上層畫面 |

- **VAL `<key> <value>`**（DB 值變動）→ shell 先更新 `Shell.store[key]`，再呼叫**每個**畫面的 `onVal(key, value)`。你在 `onVal` 裡只挑你關心的 key 反應即可。

**你不自己判斷硬體狀態**（no_signal、音量值、Information 欄位全由後端經 websocket (WS) 給）。你只負責畫面。

---

## 8. source-bound 底層（特殊：綁某個來源的全屏內容）

像 USB 播放器這種「選到某來源就全屏顯示、不由按鍵叫出」的畫面，叫 **source-bound 底層**。做法：screenDef 加 `source: '<TOKEN>'` + 對應 `layer: 'source.<token>'`。

```js
Shell.register({
  id: 'app-usb',
  layer: 'source.usb',
  source: 'USB',            // ← 關鍵：綁 USB 來源
  mount: function (el) { /* 畫你的播放器殼 */ },
  onShow: function (params) { /* params.base === true 表示以底層身分顯示 */ },
  onNav: function (act) { return false; }  // 讓 MENU/VOL 等系統鍵照常路由
});
```

shell 會在 `currentSource === 'USB'` 時自動把main顯示為**不透明底層**（在所有 overlay 之下），切走時自動隱藏。不用自己 show/hide 外部的物件。範例完整見 `screens/app-usb.js`。

---

## 9. 你會用到的 Shell API

| 呼叫 | 作用 |
|---|---|
| `Shell.show(id)` / `Shell.hide(id)` | 開 / 關畫面（通常開自己） |
| `Shell.getLayerRank(name)` | 查層級名次 |
| `Shell.store[key]` | 讀 DB 快取值（如 `Shell.store['generic_volume']`） |
| `Shell.currentSource` | 當前來源 token（`HOME`/`HDMI1`/`USB`…） |
| `Shell.selectSource(token)` | 切源（送 `SOURCE <token>`、翻底層） |
| `Shell.send(line)` | 送一行給後端（如 `Shell.send('GET key')`） |
| `Shell.DEFAULT_TIMEOUT` | 統一逾時常數（15000ms） |

---

## 10. Do / Don't

✅ **Do**
- 只碰自己的 `el`。
- 共享狀態一律讀 `Shell.store[...]` / `Shell.currentSource`。
- `mount` 只建一次 DOM；每次顯示的刷新放 `onShow`。


❌ **Don't**
- 不要伸手改別人畫面的 DOM。
- 不要自己寫絕對 `z-index` 去跟別的畫面比高低（那是 shell 的事；你只設 `layer`）。
- 不要在畫面裡自己開 WebSocket／自己判斷 no_signal（後端會推給你）。
- 不要改 `shell.js`、`transport-ws.js`（那是共用核心；要改層級表跟我們說）。

---

## 11. 除錯

- **DEV PANEL**（右下角）：手動送任何 NAV、切 no_signal/signal lock、切源，即時看 stack。
- **`node smoke-test.js`**：改完跑一次，26 項要全 PASS。它會驗：層級堆疊、No Signal 再現、Source 選單送值、source-bound 底層、以及「搬動層級表 → 順序對調」的回歸。
- Console：`Shell.on('warn', console.log)` 可看 shell 的警告（如註冊到未知 layer）。

---

## 12. 整合 UI

最終會取用：`shell.js` + `transport-ws.js` + 你們做好的 `screens/*.js`。而 `index.html` 會**移除** `mock-transport.js`、`dev-panel.js`，transport 改走真 WS (websocket)。

**`mock-transport.js` / `dev-panel.js` / `smoke-test.js` 可供測試用**，你可以上面做開發輔助，但不要合回來。

---

## 13. FAQ

**Q：每畫一個物件都要 register 嗎？**
不用。`register` 是「一個**畫面**一次」。畫面裡的按鈕、文字、圖都是普通 HTML，不用 register。

**Q：兩個畫面同時想顯示會怎樣？**
shell 只顯示層級最高的那個；其餘隱藏。層級由 `layer` 決定。

**Q：我的層級名不在表裡？**
`register` 會 throw。請從 §6 的表挑現有名字；真的需要新層級，跟我們說，我們在 `LAYER_ORDER` 加一筆。

**Q：z-order 之後會不會變？**
可能會微調，但因為是具名相對表，調整時你的畫面檔不用改。

