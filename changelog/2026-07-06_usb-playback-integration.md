# USB Media Player 播放功能整合

**日期**: 2026-07-06

## 變更摘要

將 webUI_play 的媒體播放功能整合到 webUI，讓使用者在 USB Media Player 瀏覽檔案時，可以直接播放圖片、影片、音樂。同時在 DEV PANEL 新增播放控制按鍵（SVG 圖示）。

## 變更內容

### DEV PANEL 新增播放控制按鍵

在 `dev-panel.js` 新增 Playback 按鍵列，使用 SVG 圖示：

| 按鍵 | NAV 事件 | 功能 |
|------|----------|------|
| ▶ | `PLAY` | 播放/暫停切換 |
| ■ | `STOP` | 停止播放 |
| ⏪ | `REW` | 快退 10 秒 |
| ⏩ | `FF` | 快轉 10 秒 |
| ⏮ | `PREV_FRAME` | 前一幀（並暫停） |
| ⏭ | `NEXT_FRAME` | 後一幀（並暫停） |

另新增 `OPTION` 鍵到 NAV 按鍵列。

### USB Media Player 播放功能

在 `screens/app-usb.js` 新增播放相關功能：

1. **播放畫面 (playing view)**
   - 顯示檔案圖示、檔案名稱
   - 播放狀態（Playing / Paused）
   - 進度條與時間顯示
   - 播放模式徽章
   - 檔案計數器

2. **播放模式選單 (option-menu view)**
   - Single - 播放一次後停止
   - Repeat One - 重複播放當前檔案
   - Repeat All - 循環播放所有檔案
   - Shuffle - 隨機播放

3. **播放控制**
   - `OK` / `PLAY` - 暫停/繼續
   - `STOP` - 停止播放，回到檔案瀏覽
   - `LEFT` / `RIGHT` - 上一個/下一個檔案
   - `FF` - 快轉 10 秒
   - `REW` - 快退 10 秒
   - `NEXT_FRAME` - 後一幀並暫停
   - `PREV_FRAME` - 前一幀並暫停
   - `OPTION` - 開啟播放模式選單
   - `BACK` - 回到檔案瀏覽

### 使用流程

1. 切換到 USB source
2. Insert USB → 選擇 USB 裝置
3. 在分割畫面中瀏覽檔案（左欄分類、右欄 4x3 grid）
4. 選中圖片/影片/音樂檔案，按 **OK** 或 **PLAY** 進入播放畫面
5. 播放中可使用 DEV PANEL 的播放控制按鍵或 NAV 按鍵操作
6. 按 **OPTION** 可切換播放模式
7. 按 **BACK** 或 **STOP** 回到檔案瀏覽

## 影響檔案

- `dev-panel.js` - 新增 Playback 按鍵列（SVG 圖示）、新增 OPTION 鍵
- `screens/app-usb.js` - 新增播放功能、播放模式選單、相關 CSS 樣式

## 測試步驟

1. 用瀏覽器開啟 `index.html`
2. 在 DEV PANEL 將 source 切換到 `USB`
3. 點擊 `Insert USB` 插入模擬 USB 裝置
4. 按 `OK` 進入 USB 裝置
5. 使用方向鍵瀏覽，選擇一個媒體檔案
6. 按 `OK` 或 DEV PANEL 的播放按鍵進入播放畫面
7. 測試各播放控制功能：
   - 暫停/繼續
   - 快轉/快退
   - 上一個/下一個
   - 逐幀控制
   - 停止
8. 按 `OPTION` 測試播放模式切換
9. 執行 `node smoke-test.js` 確認 26 項測試全部通過

## 備註

- 播放功能在 app-usb 內部切換 view，不開新的 screen
- 遵循 slides.html 規範，所有控制透過 NAV 事件傳遞
- 模擬播放時間：影片 1-4 分鐘、音樂 2-6 分鐘、圖片 5 秒
