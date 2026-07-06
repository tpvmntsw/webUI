# USB Media Player PC 鍵盤支援與 Play/Pause 修正

**日期**: 2026-07-06

## 變更摘要

為 USB Media Player 新增 PC 鍵盤操作支援，並修正 DEV TOOL 的 Play/Pause 邏輯，使播放控制行為符合預期。

## 變更內容

### 功能新增

1. **PC 鍵盤操作支援**（僅在 USB Media Player 頁面生效）
   - 方向鍵（↑↓←→）：對應 DEV TOOL 的 UP/DOWN/LEFT/RIGHT
   - Enter 鍵：
     - 在左欄時進入右欄
     - 在資料夾上時進入資料夾
     - 在媒體檔案上時進入播放頁面並開始播放
     - 在播放中時切換暫停/播放
   - B/b 鍵：對應 BACK
   - I/i 鍵：對應 INFO
   - O/o 鍵：對應 OPTION
   - D/d 鍵：切換 DEV PANEL 顯示/隱藏

2. **DEV PANEL 新增 PAUSE 按鈕**
   - 在 Playback 控制列新增獨立的 PAUSE 按鈕
   - Play 按鈕更新為「Play (resume when paused)」
   - Pause 按鈕標示為「Pause (pause when playing)」

### 功能修正

1. **Play/Pause 邏輯修正**
   - `PLAY`：僅在暫停時恢復播放，播放中按 Play 無動作
   - `PAUSE`：僅在播放中時暫停，暫停時按 Pause 無動作
   - `OK`：維持原有行為，始終切換暫停狀態

## 影響檔案

- `screens/app-usb.js` - 新增 PC 鍵盤事件監聽、修正 Play/Pause 邏輯
- `dev-panel.js` - 新增 PAUSE 按鈕

## 測試步驟

1. 用瀏覽器開啟 `index.html`
2. 在 DEV PANEL 的 source 下拉選單選擇 `USB`
3. 點擊 `Insert USB` 新增 USB 裝置
4. **測試 PC 鍵盤導覽**：
   - 使用方向鍵在 Videos/Photos/Music 分類間移動
   - 按 Enter 進入右欄
   - 使用方向鍵在檔案間移動
   - 在媒體檔案上按 Enter 進入播放
5. **測試播放控制**：
   - 播放中按 Enter → 應暫停
   - 暫停時按 Enter → 應恢復播放
   - 播放中按 DEV PANEL 的 Pause → 應暫停
   - 播放中按 DEV PANEL 的 Play → 無動作
   - 暫停時按 DEV PANEL 的 Play → 應恢復播放
   - 暫停時按 DEV PANEL 的 Pause → 無動作
6. **測試其他快捷鍵**：
   - 按 B 返回上一層
   - 在 Videos/Photos 分類的檔案上按 I 顯示資訊
   - 在播放中按 O 開啟選項選單
   - 按 D 切換 DEV PANEL 顯示/隱藏
7. 執行 `node smoke-test.js` 確認 26 項測試全部通過

## 備註

- PC 鍵盤事件僅在 USB Media Player 可見且無 overlay 覆蓋時生效
- D 鍵切換 DEV PANEL 不影響其他 PC 按鍵功能的正常運作
