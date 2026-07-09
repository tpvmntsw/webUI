# Unified Player HUD v2

**Date:** 2026-07-09

## Summary

Unified the Player HUD across all three media types (Videos, Photos, Music) with 9 controls, shared settings, and consistent Slide show speed menu behavior.

## Changes

### Unified HUD Controls (9 controls for all players)

1. **Play/Pause** - Toggle playback
2. **Rewind** - Fast backward (Videos/Music: x2-x32 speed; Photos: previous photo)
3. **Forward** - Fast forward (Videos/Music: x2-x32 speed; Photos: next photo)
4. **Previous** - Previous file
5. **Next** - Next file
6. **Play All** - Toggle play all mode
7. **Shuffle** - Toggle shuffle mode (shared: `mediaShuffleOn`)
8. **Repeat** - Toggle repeat mode (shared: `mediaRepeatOn`)
9. **Slide show speed** - Opens speed selection menu (shared: `mediaSlideSpeed`)

### HUD Icon Size and Layout

- Icon size: 50x50 pixels
- Button size: 60x60 pixels
- Button gap: 12px
- Button border-radius: 8px

### Slide Show Speed Behavior

**Icon appearance:**
- Photos HUD: Icon is highlighted (white)
- Videos/Music HUD: Icon is gray but fully functional

**Menu behavior (same for all three players):**
- Press OK on Slide speed icon to open menu
- HUD auto-hide timer stops while in menu
- UP/DOWN to navigate Fast/Medium/Slow options
- OK to confirm selection (stays in menu)
- BACK to exit menu and return to HUD
- HUD auto-hide timer restarts on exit

**Effect:**
- Only affects Photos slideshow timing
- Setting is shared across all players via `mediaSlideSpeed`

### HUD Auto-Hide Timer Behavior

**LEFT/RIGHT navigation:**
- Restarts 5-second auto-hide timer (if not locked by INFO)
- If HUD was opened by INFO key (locked), timer does not restart

**INFO key behavior:**
- Opens HUD in locked mode (`hudLocked = true`)
- HUD stays visible until triggered by OK/PLAY/PAUSE

### Shared State Variables

All players now use unified state variables:
- `mediaShuffleOn` - Shuffle setting
- `mediaRepeatOn` - Repeat setting  
- `mediaSlideSpeed` - Slide show speed ('fast' | 'medium' | 'slow')

Changes in HUD sync back to Options menu, and vice versa.

### Music Category Display

- Music now shows folder structure like Videos/Photos (not flat file list)
- Folders display with folder icon in 4x3 grid
- Navigation through folders same as other categories

### Removed Features

- Metadata line below filename in all HUDs:
  - Music: Artist | Album | Genre removed
  - Photo: Dimensions | Date | Size removed
- Album art in Music Player HUD

### Play All from Options

All Options menus correctly trigger Play all:
- Videos Options > Play all - plays all videos in folder
- Photos Options > Play all - plays all photos as slideshow
- Music Options > Play all - plays all music in folder

## Technical Details

### New Functions

- `getPlayerIcon(type, isHighlight, speed)` - Unified icon generator
- `openPlayerSlidespeedMenu(source)` - Opens speed menu, stops HUD timer
- `closePlayerSlidespeedMenu(showHud)` - Closes menu, optionally shows HUD with timer
- `renderPlayerSlidespeedMenu()` - Renders speed selection menu
- `confirmPlayerSlidespeedMenu()` - Applies selected speed
- `handlePlayerSlidespeedMenuNav(act)` - Handles menu navigation

### New DOM Element

- `.player-slidespeed-menu` - Unified speed menu overlay

### New CSS Classes

- `.player-hud` - Unified HUD container
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
- `.player-ctrl-off` - Inactive control (gray)
- `.player-fast-speed` - Fast mode speed indicator
- `.player-slidespeed-menu` - Speed menu overlay

### Files Modified

- `screens/app-usb.js`
  - Added unified `getPlayerIcon()` function
  - Updated all three `render*Player()` functions
  - Updated all three `handle*PlayerOK()` functions  
  - Updated all three `handle*PlayerNav()` functions
  - Added player slidespeed menu functions
  - Added `playerSlidespeedMenuEl` DOM reference
  - Updated `render()` function for new view
  - Updated `onNav()` for menu navigation
  - Fixed Music category to show folder structure
  - Removed duplicate `playAllMusicFromOptions()` function
  - Added unified CSS classes
