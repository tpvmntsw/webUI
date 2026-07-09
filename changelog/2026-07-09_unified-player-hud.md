# Unified Player HUD

**Date:** 2026-07-09

## Summary

Unified the Player HUD across all three media types (Videos, Photos, Music) with a consistent control layout and shared styling. Removed metadata line below filename, added Play All and Slide show speed controls to all players.

## Changes

### Unified HUD Controls (9 controls for all players)

1. **Play/Pause** - Toggle playback
2. **Rewind** - Fast backward (Videos/Music: x2-x32 speed; Photos: previous photo)
3. **Forward** - Fast forward (Videos/Music: x2-x32 speed; Photos: next photo)
4. **Previous** - Previous file
5. **Next** - Next file
6. **Play All** - Toggle play all mode
7. **Shuffle** - Toggle shuffle mode (shared: mediaShuffleOn)
8. **Repeat** - Toggle repeat mode (shared: mediaRepeatOn)
9. **Slide show speed** - Opens speed selection menu (shared: mediaSlideSpeed)

### Slide Show Speed Behavior

- **Photos**: Icon is highlighted (white), affects slideshow timing
- **Videos/Music**: Icon is gray but still functional, opens speed selection menu
- All players share same `mediaSlideSpeed` variable
- Speed selection menu (Fast/Medium/Slow) accessible from all HUDs

### Removed Features

- Metadata line below filename in all HUDs:
  - Music: Artist | Album | Genre
  - Photo: Dimensions | Date | Size
- Album art in Music Player HUD

### Music Category Changes

- Music now shows folder structure like Videos/Photos (not flat file list)
- Folders display with folder icon in 4x3 grid
- Navigation through folders same as other categories

### Unified CSS Classes

New shared CSS classes:
- `.player-hud` - Main HUD container
- `.player-hud-top` - Top row (filename + counter)
- `.player-filename` - File name display
- `.player-counter` - File counter (X/Y)
- `.player-progress` - Progress bar row
- `.player-time` - Time display
- `.player-progress-bar` - Progress bar container
- `.player-progress-fill` - Progress bar fill
- `.player-controls` - Control buttons row
- `.player-ctrl-btn` - Control button
- `.player-ctrl-selected` - Selected control
- `.player-ctrl-on` - Active/highlighted control
- `.player-ctrl-off` - Inactive control
- `.player-fast-speed` - Fast mode speed indicator (x2, x4, etc.)

### Unified Icon Function

New `getPlayerIcon(type, isHighlight, speed)` function replaces:
- `getMusicPlayerIcon()`
- `getVideoPlayerIcon()`
- `getPhotoPlayerIcon()`

Icon size: 60x60 (down from 80x80)

### State Synchronization

All players now sync Shuffle/Repeat/SlideSpeed with unified `mediaShuffleOn`, `mediaRepeatOn`, `mediaSlideSpeed` variables.

### HUD Layout

Compact layout with:
- Padding: 20px 28px
- Control button size: 70x70px
- Control gap: 16px
- Filename font: 1.6rem
- Counter font: 1.3rem

## Files Modified

- `screens/app-usb.js`
  - Added `getPlayerIcon()` unified icon function
  - Updated `renderVideoPlayer()` to use unified HUD
  - Updated `renderMusicPlayer()` to use unified HUD
  - Updated `renderPhotoPlayer()` to use unified HUD
  - Updated `handleVideoPlayerOK()` for 8 controls
  - Updated `handleMusicPlayerOK()` for 8 controls (removed PlayAll)
  - Updated `handlePhotoPlayerOK()` for 8 controls (rewind/forward = prev/next)
  - Updated all player NAV handlers for 8-control navigation
  - Added unified `.player-*` CSS classes
