# USB Media Player 檔案資訊對話框功能

**日期**: 2026-07-06

## 變更摘要

為 USB Media Player 新增 INFO 鍵功能，可顯示影片和圖片檔案的 metadata 對話框。

## 變更內容

### 新增功能

1. **INFO 按鈕支援**
   - 在 dev-panel.js 的 NAV_KEYS 新增 'INFO' 按鈕
   - 可在開發面板點擊測試 INFO 功能

2. **Video metadata 對話框**
   - 在 Videos 類別中選擇影片檔案時按 INFO 鍵顯示
   - 顯示內容：Title（檔名）、Size（檔案大小）、Date（日期）、Duration（時長）
   - 按 OK、BACK 或 INFO 關閉對話框

3. **Picture metadata 對話框**
   - 在 Photos 類別中選擇圖片檔案時按 INFO 鍵顯示
   - 顯示內容：Title（檔名）、Date（日期）、Size（圖片尺寸如 1920 x 1080）
   - 按 OK、BACK 或 INFO 關閉對話框

### 新增輔助函數

- `isPhotoFile(filename)` - 判斷是否為圖片檔案
- `generateMockDimensions()` - 產生模擬圖片尺寸
- `renderVideoInfo()` - 根據類別渲染對應的 metadata 對話框
- `showVideoInfo()` - 顯示 metadata 對話框（支援 video 和 photo）
- `closeVideoInfo()` - 關閉對話框

### CSS 樣式

新增 `.usb-video-info-*` 系列樣式，對話框設計參考實機畫面：
- 半透明背景遮罩 + 模糊效果
- 灰色圓角對話框
- 藍色圓角 Close 按鈕

## 影響檔案

- `dev-panel.js` - 新增 INFO 按鈕
- `screens/app-usb.js` - 新增 metadata 對話框功能

## 測試步驟

1. Source 切到 USB，插入 USB 裝置
2. 進入 Videos 類別，選擇一個影片檔案
3. 按 INFO 鍵，確認顯示 "Video metadata" 對話框
4. 確認顯示 Title、Size、Date、Duration 資訊
5. 按 OK 或 BACK 關閉對話框
6. 進入 Photos 類別，選擇一個圖片檔案
7. 按 INFO 鍵，確認顯示 "Picture metadata" 對話框
8. 確認顯示 Title、Date、Size（尺寸）資訊
9. 按 OK 或 BACK 關閉對話框
