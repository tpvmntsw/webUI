# USB 設備列表分割面板佈局

**日期**: 2026-07-06

## 變更摘要

將 USB 設備選擇畫面從簡單清單改為分割面板佈局，與進入 Media 後的 Videos/Photos/Music 畫面風格一致。同時將 USB 圖示改為更接近 U盤造型的 SVG 圖示。

## 變更內容

### 功能修正

1. **分割面板佈局**
   - 左側面板：顯示大型 U盤 SVG 圖示 + "USB Devices" 標題
   - 右側面板：顯示設備名稱清單，最多 7 列
   - 佈局風格與 Media 分類選擇畫面一致

2. **U盤 SVG 圖示**
   - 左側大圖示 (120x120)：完整 U盤造型，包含藍色本體、USB 接頭、金屬接點、狀態指示燈
   - 右側列表小圖示 (32x32)：簡化版 U盤造型
   - 取代原本的軟碟 emoji (💾)

3. **CSS 樣式調整**
   - 新增 `.usb-device-split` 分割容器
   - 新增 `.usb-device-left-panel` 左側面板樣式
   - 新增 `.usb-device-right-panel` 右側面板樣式
   - 更新 `.usb-device-row-icon` 支援 SVG 顯示

## 影響檔案

- `webUI/screens/app-usb.js` - 設備列表渲染邏輯及樣式

## 測試步驟

1. 開啟 `webUI/index.html`
2. 切換到 USB 輸入源
3. 在 DEV PANEL 輸入 USB 裝置名稱並點擊 "Insert USB"
4. 確認畫面顯示為分割佈局：左邊 U盤圖示 + 標題，右邊設備清單
5. 確認列表項目前方顯示小 U盤圖示
6. 使用上下鍵選擇設備，確認高亮效果正常
