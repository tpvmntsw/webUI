# USB Media Player - Video Options Menu

**Date:** 2026-07-08

## Summary
Added Options menu for the Video category in USB Media Player, mirroring the Photo Options implementation. The menu provides Play all, List/Thumbnails view mode, Shuffle, Repeat settings, and Info display for video viewing. Note: Slide show speed is not included for Videos as it doesn't apply to video playback.

## Changes

### app-usb.js

#### New State Variables
- `videoOptionsEl` - DOM element for Options dialog
- `videoViewmodeSubmenuEl` - DOM element for List/Thumbnails submenu
- `videoRepeatSubmenuEl` - DOM element for Repeat submenu
- `videoInfoDialogEl` - DOM element for Video Info dialog (from Options)
- `videoOptionsIndex` - Current selection index in Options menu
- `videoViewMode` - View mode: 'thumbnails' (default) or 'list'
- `videoShuffleOn` - Shuffle toggle state (default: false)
- `videoRepeatMode` - Repeat mode: 'play-once' (default) or 'repeat'
- `videoViewmodeSubmenuIndex` - Selection index in view mode submenu
- `videoRepeatSubmenuIndex` - Selection index in Repeat submenu
- `videoOptionsFromLeftPanel` - Whether Options was opened from left panel

#### New Views
- `video-options` - Options dialog view
- `video-viewmode-submenu` - List/Thumbnails submenu view
- `video-repeat-submenu` - Repeat submenu view
- `video-info-dialog` - Video Info dialog view (with blurred background)

#### New Functions
- `isVideoCategory()` - Checks if current category is Video
- `openVideoOptions(fromLeftPanel)` - Opens Options menu
- `closeVideoOptions()` - Closes Options menu
- `renderVideoOptions()` - Renders the Options dialog
- `getVideoOptionsMaxIndex()` - Returns max menu index based on context
- `getVideoOptionItem(index)` - Returns menu item name by index
- `handleVideoOptionsOK()` - Handles OK on Options items
- `handleVideoOptionsRight()` - Handles RIGHT for submenu items
- `openVideoViewmodeSubmenu()` - Opens List/Thumbnails submenu
- `closeVideoViewmodeSubmenu()` - Returns to Options menu
- `renderVideoViewmodeSubmenu()` - Renders view mode submenu
- `confirmVideoViewmode()` - Selects view mode option
- `openVideoRepeatSubmenu()` - Opens Repeat submenu
- `closeVideoRepeatSubmenu()` - Returns to Options menu
- `renderVideoRepeatSubmenu()` - Renders Repeat submenu
- `confirmVideoRepeat()` - Selects repeat option
- `showVideoInfoDialog()` - Shows video metadata dialog (blurred background)
- `closeVideoInfoDialog()` - Closes info dialog
- `renderVideoInfoDialog()` - Renders video info content
- `buildPlayableVideoList()` - Builds list of video files
- `playAllVideosFromOptions()` - Starts video playback from Options

#### Options Menu Items (context-dependent)

**On left panel (Videos category) or folder:**
- List/Thumbnails - Opens submenu with arrow (>)
- Shuffle - Toggle On/Off with visual switch
- Repeat - Opens submenu with arrow (>)

**On video file:**
- Play all - Starts video playback (like Photos Slide show)
- List/Thumbnails - Opens submenu with arrow (>)
- Shuffle - Toggle On/Off with visual switch
- Repeat - Opens submenu with arrow (>)
- Info - Shows video metadata (with blurred background)

#### Submenu Items

**List/Thumbnails:**
- Thumbnails (default)
- List

**Repeat:**
- Repeat once (default)
- Repeat

#### Video Info Dialog
- Title: Video filename
- Size: File size (e.g., "123.45 MB")
- Date: File date (e.g., "15/03/2026")
- Duration: Video duration (e.g., "02:35")
- Background: Blurred current view
- Close: OK, BACK, or INFO key

#### Navigation

Options page:
- UP/DOWN: Move between items
- OK/Enter: Select item
- RIGHT: Enter submenu (for items with arrow)
- BACK/OPTION: Close menu

Submenus:
- UP/DOWN: Move between options
- OK/Enter: Select option (checkmark updates)
- LEFT/BACK: Return to Options page

Video Info dialog:
- OK/BACK/INFO: Close dialog

#### Trigger
- PC keyboard: Press `O` or `o` when in Videos category
- DEV PANEL: Press OPTION button when in Videos category
- Available when cursor is on:
  - Videos in left category panel
  - Folder in Videos (right panel)
  - Video file in Videos (right panel)

#### Styling
- Matches Photo Options dialog style
- Gray background (#4a5568) with border (#718096)
- Golden yellow title (#ffc239)
- Blue highlight for selected items (#3182ce)
- Toggle switch for Shuffle (gray off, blue on)
- Checkmark for current selections
- Info dialog: blurred background with backdrop-filter

#### CSS Classes Added
- `.video-options` - Main Options dialog container
- `.video-opt-dialog` - Dialog box styling
- `.video-opt-header` - Header area
- `.video-opt-title` - Title text styling
- `.video-opt-list` - Menu items container
- `.video-opt-item` - Individual menu item
- `.video-opt-item-selected` - Selected item highlight
- `.video-opt-name` - Item name text
- `.video-opt-arrow` - Submenu arrow indicator
- `.video-opt-toggle` - Toggle switch base
- `.video-opt-toggle-on/off` - Toggle states
- `.video-submenu` - Submenu dialog container
- `.video-submenu-dialog` - Submenu dialog box
- `.video-submenu-header/title/list/item/name/check` - Submenu styling
- `.video-info-dialog` - Info dialog container
- `.video-info-dlg-*` - Info dialog content styling

#### Play All Behavior
- Starts from first video in folder (or random if Shuffle on)
- Uses existing video player (`playing` view)
- Respects Shuffle setting for playback order
- Respects Repeat mode setting

## Differences from Photo Options
- No "Slide show speed" option (not applicable to video)
- Video Player has 5 controls (no speed icon): Play/Pause, Prev, Next, Shuffle, Repeat
- Video HUD layout: filename + counter on top row, progress bar with time, controls row

## Video Player
Added dedicated Video Player (similar to Photo Player) with the following features:

### Video Player State Variables
- `videoPlayerEl` - DOM element for Video Player
- `videoPlayerControlIndex` - Current control selection (0-4)
- `videoPlayerPlayAllOn` - Play all mode toggle
- `videoPlayerShuffleOn` - Shuffle state (syncs with Options)
- `videoPlayerRepeatOn` - Repeat state (syncs with Options)
- `videoPlayerReturnToIndex` - Index to return to after closing
- `videoPlayerFromPlayAll` - Whether entered via Play all
- `videoPlayerPlayedIndices` - Tracks played videos for shuffle
- `videoPlayerHudVisible` - HUD visibility state
- `videoPlayerHudTimer` - Auto-hide timer
- `videoPlayerHudLocked` - HUD locked by INFO key

### Video Player Controls (5 icons)
1. Play/Pause - Toggle playback
2. Previous - Go to previous video
3. Next - Go to next video
4. Shuffle - Toggle shuffle (syncs with Video Options)
5. Repeat - Toggle repeat (syncs with Video Options)

### Video Player HUD Layout
- Top row: Filename (left) + Counter "X/Y" (right)
- Middle row: Time elapsed + Progress bar + Total duration
- Bottom row: 5 control icons (wider spacing than Photo Player)
- Background: Animated gradient (blue tones)
- Large timer display in background

### Video Player Navigation
- LEFT/RIGHT: Move between controls
- OK: Activate selected control (or show HUD if hidden)
- PLAY: Resume playback
- PAUSE: Pause playback
- BACK: Exit player
- INFO: Toggle HUD visibility

### Sync Behavior
- Shuffle and Repeat settings sync bidirectionally between Video Options and Video Player
- Changes in Player update Options settings
- Changes in Options apply to new Player sessions

### Video Player CSS Classes
- `.video-player-view` - Main container
- `.vp-bg` - Background with gradient
- `.vp-timer` - Large timer display
- `.vp-pause-icon` - Pause indicator
- `.vp-hud` - Bottom HUD container
- `.vp-hud-top` - Top row (filename + counter)
- `.vp-filename` - Video filename display
- `.vp-counter` - Video counter (X/Y)
- `.vp-progress` - Progress bar row
- `.vp-time` - Time display
- `.vp-progress-bar` / `.vp-progress-fill` - Progress bar
- `.vp-controls` - Control icons container
- `.vp-ctrl-btn` - Individual control button
- `.vp-ctrl-selected` - Selected control highlight
- `.vp-ctrl-off` - Inactive state

## Testing
- Smoke tests: 26 passed, 0 failed
