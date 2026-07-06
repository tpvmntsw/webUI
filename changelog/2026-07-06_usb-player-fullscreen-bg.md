# USB Media Player Fullscreen Background

**Date:** 2026-07-06

## Summary

播放畫面改為全螢幕模擬影片背景，移除原本的大圖示 UI，改用底部 HUD 顯示播放資訊。

## Changes

### Player Background
- **全螢幕漸層背景**：根據檔案類型顯示不同色調
  - 影片 (video)：深藍色漸層 (`#1a1a2e` → `#16213e` → `#0f3460`)
  - 照片 (photo)：灰色漸層 (`#2d3436` → `#636e72` → `#b2bec3`)
  - 音樂 (music)：深紫色漸層 (`#0d0d0d` → `#1a1a2e` → `#2d132c`)
- **大型計時器**：螢幕中央顯示 `MM:SS` 格式（12rem 字體，半透明白色）
- **暫停指示**：暫停時中央顯示暫停圖示

### Bottom HUD Overlay
- 取代原本置中的播放資訊 UI
- 半透明漸層背景 (`transparent` → `rgba(0,0,0,.8)`)
- **左側**：播放/暫停狀態圖示 + 檔名
- **中間**：已播放時間 + 進度條 + 總時長
- **右側**：播放模式圖示 + 檔案計數器 (n/total)

### Removed
- 原本的 `.usb-player-content` 置中大圖示 UI
- `.usb-player-icon`、`.usb-player-info`、`.usb-player-filename` 等舊樣式
- 右上角的播放模式標籤、左上角的計數器（移至底部 HUD）
