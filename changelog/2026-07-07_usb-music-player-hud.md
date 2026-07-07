# USB Music Player HUD

**Date:** 2026-07-07

## Summary
新增 Music Player 播放介面，參考 `/ref/mp.jpg` 設計，提供完整的音樂播放控制功能。

## Changes

### 新增 Music Player 視圖
- **專屬播放介面**: 從 Music 列表選擇音樂檔按 Enter/OK/PLAY，或從 Music Options 選擇 Play all 進入
- **HUD 佈局**:
  - 左側: 專輯封面區 (無封面時顯示單一大型音符圖示)
  - 右側第一行: 檔名 (大字體)
  - 右側第二行: Artist | Album | Genre (小字體，無資料時不顯示)
  - 右側第三行: 播放進度條與時間顯示 (00:00:00 / 00:00:00)
  - 右側第四行: 8 個控制圖示 (置中顯示，雙倍大小)

### 8 個控制圖示功能
1. **Play/Pause**: 播放時顯示 Pause 圖示，暫停時顯示 Play 圖示
2. **快速倒退**: 按下後依序切換 x2→x4→x8→x16→x32 循環
3. **快速前進**: 按下後依序切換 x2→x4→x8→x16→x32 循環
4. **上一首**: 跳到上一首歌曲
5. **下一首**: 跳到下一首歌曲
6. **Play All**: 開關切換 (Off=灰色, On=白色)
7. **Shuffle**: 開關切換 (Off=灰色, On=白色)，同步連動 Music Options
8. **Repeat**: 開關切換 (Play once=灰色, Repeat=白色)，同步連動 Music Options

### 播放行為邏輯

| Play All | Shuffle | Repeat | 行為 |
|----------|---------|--------|------|
| Off | Off | Off | 播放當前歌曲一次後自動停止 |
| Off | On | Off | 播放當前歌曲一次後自動停止 |
| Off | Off | On | 重複播放當前歌曲，不會停止 |
| Off | On | On | 重複播放當前歌曲，不會停止 |
| On | Off | Off | 依序播放所有歌曲一次後自動停止 |
| On | On | Off | 隨機播放所有歌曲一次 (每首僅播一次) 後自動停止 |
| On | Off | On | 依序播放所有歌曲，循環播放不停止 |
| On | On | On | 隨機播放所有歌曲一輪後，重複隨機循環不停止 |

### 導航操作
- **LEFT/RIGHT**: 在控制圖示間移動
- **OK/PLAY/Enter**: 執行選中的控制功能
- **BACK (b/B)**: 退出播放器，返回音樂列表並定位到最後播放的檔案
- **FF/REW 按鍵**: 直接觸發快速前進/倒退

### 其他修改
- **Music Options**: "Play All" 改為 "Play all"
- **Metadata 快取**: 音樂檔案的 Artist/Album/Genre 資訊會快取，避免每次渲染時重新產生

## Files Modified
- `webUI/screens/app-usb.js`

## Documentation
- `webUI/doc/Music_Player_Playback_Behavior.docx` - 播放行為說明文件
