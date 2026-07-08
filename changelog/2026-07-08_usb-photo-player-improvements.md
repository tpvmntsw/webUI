# USB Media Player - Photo Player Improvements

**Date:** 2026-07-08

## Summary
Improved Photo Player behavior including HUD styling, speedometer icon, cached metadata, and playback behavior changes.

## Changes

### Photo Player HUD Styling
- Control button size changed from 80x80 to 100x100 (matching Music HUD)
- Control buttons now centered (`justify-content: center`)
- Button gap changed from 24px to 32px (matching Music HUD)

### Speedometer Icon
- Replaced clock icon with speedometer icon for slide show speed control
- Speedometer needle direction changes based on speed setting:
  - **Fast**: Needle points right
  - **Medium**: Needle points up
  - **Slow**: Needle points left

### Cached Photo Metadata
- Added `photoFileMetaCache` to cache photo metadata per file
- Added `getPhotoFileInfo(entry, index)` function to retrieve/generate cached metadata
- Photo info (dimensions, date, file size) no longer jumps during playback
- Each photo file has consistent metadata across renders

### Background Image Fix
- Fixed negative index handling in `getPhotoBackground()` function
- Changed CSS background style format to use single quotes for proper data URI parsing
- Background images now display correctly using `currentPlayingIndex`

### Playback Behavior Changes
- **Single photo playback ends paused**: When playing a single photo (no Slide show, no Repeat), playback stops at the photo instead of returning to Photos Menu
- **BACK to return**: User must press BACK (b/B on PC) to return to Photos Menu
- **Cursor position preserved**: When returning from Photo Player, cursor stays on the last played photo

### Photo Player Options
- **OPTION key disabled in Photo Player**: Pressing o/O or OPTION during photo playback does nothing (no Playback Mode menu)
- **INFO key functional**: Pressing i/I or INFO shows Photo Info dialog with metadata

### Photo Player Info Dialog
- New `photo-player-info` view for displaying photo metadata during playback
- Shows: Title, Date, Size (dimensions), File size
- Close with OK, BACK, or INFO key

### Submenu Title Changes
- Music: `Options / Repeat` changed to `Repeat`
- Photos: `Options / List/Thumbnails` changed to `List/Thumbnails`
- Photos: `Options / Repeat` changed to `Repeat`
- Photos: `Options / Slide show speed` changed to `Slide show speed`

### PC Keyboard Fix
- Fixed Enter key on photo files to use `openPhotoPlayer()` instead of `playFile()`
- Photos now consistently use the new Photo Player HUD regardless of input method

## Technical Details

### New State Variables
- `photoFileMetaCache` - Cache object for photo metadata

### New Functions
- `getPhotoFileInfo(entry, index)` - Get or generate cached photo metadata
- `openPhotoPlayerInfo()` - Open Photo Info dialog in player
- `closePhotoPlayerInfo()` - Close Photo Info dialog
- `renderPhotoPlayerInfo()` - Render Photo Info dialog content

### Modified Functions
- `getPhotoPlayerIcon(type, isHighlight, speed)` - Added speed parameter for speedometer
- `getPhotoBackground(index)` - Fixed negative index handling
- `renderPhotoPlayer()` - Uses cached metadata, fixed background style
- `onPhotoPlayerComplete()` - Stays paused on photo instead of closing
- `handlePhotoPlayerNav(act)` - OPTION returns true (no action), INFO opens info dialog

### New CSS Classes
- `.photo-player-info` - Info dialog overlay
- `.pp-info-dialog` - Info dialog container
- `.pp-info-title` - Info dialog title
- `.pp-info-content` - Info dialog content
- `.pp-info-row` - Info row styling
- `.pp-info-label` - Info label styling
- `.pp-info-close` - Close button styling

### New HTML Elements
- `<div class="photo-player-info"></div>` - Photo Player Info dialog

## Testing
- Smoke tests: 26 passed, 0 failed
