# USB Media Player 類別選單調整

**日期**: 2026-07-06

## 變更摘要

調整 USB Media Player 左側類別選單：移除 Folder 項目、重新排序並更名、調整視覺樣式使項目居中並放大圖示文字。

## 變更內容

### 類別項目調整

1. **移除 Folder 類別**
   - 原本有 4 個類別：Folder, Music, Video, Photo
   - 移除 Folder，剩下 3 個類別

2. **重新排序並更名**
   - Video → Videos（排序第 1）
   - Photo → Photos（排序第 2）
   - Music（排序第 3，名稱不變）

### 左側面板樣式調整

1. **垂直居中**
   - 新增 `justify-content:center` 使 3 個項目垂直居中顯示

2. **圖示與文字放大**
   - 圖示從 3.5rem → 4.2rem（放大約 1.2 倍）
   - 文字從 1.3rem → 1.5rem
   - 圖示與文字間距從 8px → 12px（避免重疊）
   - 項目間距從 8px → 10px

3. **選中效果微調**
   - 選中時圖示縮放從 1.3 → 1.1
   - 選中時文字縮放從 1.5 → 1.1
   - 確保放大後不超出框框範圍

## 影響檔案

- `screens/app-usb.js`

## 測試步驟

1. Source 切到 USB，插入 USB 裝置後進入 Media Player
2. 確認左側只有 3 個類別：Videos, Photos, Music
3. 確認 3 個類別垂直居中顯示
4. 確認圖示和文字大小適中，不超出範圍
5. 上下移動確認選中效果正常
