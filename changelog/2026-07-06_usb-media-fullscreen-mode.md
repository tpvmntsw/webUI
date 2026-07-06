# USB Media Player Fullscreen Mode

**Date:** 2026-07-06

## Summary

USB Media Player 新增全螢幕模式：Media 瀏覽和播放畫面為 1920x1080 全螢幕，idle/devices 畫面保持原本 window 框架。

## Changes

### Layout
- **idle/devices 視圖**：保持原本 window 框架樣式（有標題欄 "USB Media Player"）
- **split/playing/option-menu/video-info 視圖**：全螢幕 1920x1080，無 window 框架
- 新增 `.usb-fullscreen` 容器包裝全螢幕視圖

### Browser Fullscreen
- 切換到 USB SOURCE 時自動進入瀏覽器全螢幕（隱藏網址列和 Windows 視窗框）
- Esc/F11 無法退出全螢幕（會立即重新進入）
- 只有透過 DEV TOOL 切換到其他 SOURCE（HDMI1/2/3 等）時才會退出全螢幕

### Input Handling
- 在 input/textarea 輸入時（如 USB simulation 輸入框）不觸發 PC 熱鍵
