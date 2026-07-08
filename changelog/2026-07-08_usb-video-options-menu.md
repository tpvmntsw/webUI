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
- Uses existing video player instead of dedicated photo player
- Play all triggers video playback (not slideshow)

## Testing
- Smoke tests: 26 passed, 0 failed
