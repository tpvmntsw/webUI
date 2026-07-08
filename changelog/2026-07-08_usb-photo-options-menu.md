# USB Media Player - Photo Options Menu

**Date:** 2026-07-08

## Summary
Added Options menu for the Photo category in USB Media Player. The menu provides Slide show, List/Thumbnails view mode, Shuffle, Repeat, Slide show speed settings, and Info display for photo viewing.

## Changes

### app-usb.js

#### New State Variables
- `photoOptionsEl` - DOM element for Options dialog
- `photoViewmodeSubmenuEl` - DOM element for List/Thumbnails submenu
- `photoRepeatSubmenuEl` - DOM element for Repeat submenu
- `photoSlidespeedSubmenuEl` - DOM element for Slide show speed submenu
- `photoPlayerEl` - DOM element for Photo Player view
- `photoInfoEl` - DOM element for Photo Info dialog
- `photoSlidespeedMenuEl` - DOM element for speed menu in player
- `photoOptionsIndex` - Current selection index in Options menu
- `photoViewMode` - View mode: 'thumbnails' (default) or 'list'
- `photoShuffleOn` - Shuffle toggle state (default: false)
- `photoRepeatMode` - Repeat mode: 'play-once' (default) or 'repeat'
- `photoSlideSpeed` - Speed: 'fast' (default), 'medium', or 'slow'
- `photoViewmodeSubmenuIndex` - Selection index in view mode submenu
- `photoRepeatSubmenuIndex` - Selection index in Repeat submenu
- `photoSlidespeedSubmenuIndex` - Selection index in speed submenu
- `photoOptionsFromLeftPanel` - Whether Options was opened from left panel
- `photoPlayerControlIndex` - Current control selection in Photo Player (0-6)
- `photoPlayerPlayAllOn` - Slide show mode toggle
- `photoPlayerShuffleOn` - Shuffle state in player
- `photoPlayerRepeatOn` - Repeat state in player
- `photoPlayerSlideSpeed` - Speed setting in player
- `photoPlayerReturnToIndex` - Index to return to after closing player
- `photoPlayerFromSlideshow` - Whether entered from Slide show option
- `photoPlayerPlayedIndices` - Tracks played photos for shuffle mode
- `photoSlidespeedMenuIndex` - Selection in player's speed menu
- `SLIDE_SPEED_SECONDS` - Speed mapping: fast=4s, medium=8s, slow=12s

#### New Views
- `photo-options` - Options dialog view
- `photo-viewmode-submenu` - List/Thumbnails submenu view
- `photo-repeat-submenu` - Repeat submenu view
- `photo-slidespeed-submenu` - Slide show speed submenu view
- `photo-player` - Photo Player (slideshow) view
- `photo-info` - Photo Info dialog view
- `photo-slidespeed-menu` - Speed menu in player view

#### New Functions
- `openPhotoOptions(fromLeftPanel)` - Opens Options menu
- `closePhotoOptions()` - Closes Options menu
- `renderPhotoOptions()` - Renders the Options dialog
- `getPhotoOptionsMaxIndex()` - Returns max menu index based on context
- `getPhotoOptionItem(index)` - Returns menu item name by index
- `handlePhotoOptionsOK()` - Handles OK on Options items
- `handlePhotoOptionsRight()` - Handles RIGHT for submenu items
- `openPhotoViewmodeSubmenu()` - Opens List/Thumbnails submenu
- `closePhotoViewmodeSubmenu()` - Returns to Options menu
- `renderPhotoViewmodeSubmenu()` - Renders view mode submenu
- `confirmPhotoViewmode()` - Selects view mode option
- `openPhotoRepeatSubmenu()` - Opens Repeat submenu
- `closePhotoRepeatSubmenu()` - Returns to Options menu
- `renderPhotoRepeatSubmenu()` - Renders Repeat submenu
- `confirmPhotoRepeat()` - Selects repeat option
- `openPhotoSlidespeedSubmenu()` - Opens speed submenu
- `closePhotoSlidespeedSubmenu()` - Returns to Options menu
- `renderPhotoSlidespeedSubmenu()` - Renders speed submenu
- `confirmPhotoSlidespeed()` - Selects speed option
- `showPhotoInfo()` - Shows photo metadata dialog
- `closePhotoInfo()` - Closes info dialog
- `renderPhotoInfo()` - Renders photo info content
- `playAllPhotosFromOptions()` - Starts slideshow from Options
- `buildPlayablePhotoList()` - Builds list of photo files
- `openPhotoPlayer(entry, fromSlideshow)` - Opens Photo Player
- `closePhotoPlayer()` - Closes Photo Player
- `startPhotoPlayerTimer()` - Starts slideshow timer
- `onPhotoPlayerComplete()` - Handles slide transition
- `playPhotoAtIndex(index)` - Plays specific photo
- `getPhotoPlayerIcon(type, isHighlight)` - Returns SVG icon for controls
- `renderPhotoPlayer()` - Renders Photo Player UI
- `handlePhotoPlayerNav(act)` - Handles navigation in player
- `handlePhotoPlayerOK()` - Handles OK on player controls
- `openPhotoSlidespeedMenu()` - Opens speed menu in player
- `closePhotoSlidespeedMenu()` - Closes speed menu in player
- `renderPhotoSlidespeedMenu()` - Renders player speed menu
- `confirmPhotoSlidespeedMenu()` - Selects speed in player
- `isPhotoCategory()` - Checks if current category is Photo

#### Options Menu Items (context-dependent)

**On left panel (Photos category) or folder:**
- List/Thumbnails - Opens submenu with arrow (>)
- Shuffle - Toggle On/Off with visual switch
- Repeat - Opens submenu with arrow (>)
- Slide show speed - Opens submenu with arrow (>)

**On photo file:**
- Slide show - Starts slideshow (like Music Play All)
- List/Thumbnails - Opens submenu with arrow (>)
- Shuffle - Toggle On/Off with visual switch
- Repeat - Opens submenu with arrow (>)
- Slide show speed - Opens submenu with arrow (>)
- Info - Shows photo metadata

#### Submenu Items

**List/Thumbnails:**
- Thumbnails (default)
- List

**Repeat:**
- Repeat once (default)
- Repeat

**Slide show speed:**
- Fast (default) - 4 seconds per slide
- Medium - 8 seconds per slide
- Slow - 12 seconds per slide

#### Photo Player Controls
- Play/Pause - Toggle slideshow pause
- Previous - Go to previous photo
- Next - Go to next photo
- Slide show (circle play icon) - Toggle slideshow mode
- Shuffle - Toggle shuffle (syncs with Options)
- Repeat - Toggle repeat (syncs with Options)
- Clock - Opens slide show speed menu

#### Photo Player HUD Layout
- First line: Current photo filename
- Second line: Photo info (dimensions | date | file size)
- Control icons row (no progress bar, no time display)
- Right side: Photo counter (e.g., "3/17")

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

Photo Player:
- LEFT/RIGHT: Move between controls
- OK: Activate selected control
- PLAY: Resume when paused
- PAUSE: Pause when playing
- BACK: Exit player

Speed menu in player:
- UP/DOWN: Move between speeds
- OK/Enter: Select speed
- BACK: Close menu

#### Trigger
- PC keyboard: Press `O` or `o`
- DEV PANEL: Press OPTION button
- Playing photo: Press `Enter` or `OK`

#### Styling
- Matches Options dialog style (Info Menu style)
- Gray background (#4a5568) with border (#718096)
- Golden yellow title (#ffc239)
- Blue highlight for selected items (#3182ce)
- Toggle switch for Shuffle (gray off, blue on)
- Checkmark for current selections
- Photo Player HUD: semi-transparent gray background

#### Sync Behavior
- Shuffle, Repeat, and Slide show speed settings sync between Options and Photo Player
- Changes in Player update Options settings
- Changes in Options apply to new Player sessions

## String Changes
- Music: `Options / Repeat` changed to `Repeat`
- Photos: `Options / List/Thumbnails` changed to `List/Thumbnails`
- Photos: `Options / Repeat` changed to `Repeat`
- Photos: `Options / Slide show speed` changed to `Slide show speed`

## Testing
- Smoke tests: 26 passed, 0 failed
