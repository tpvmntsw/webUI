# USB Video Player - Rewind/Forward Controls

**Date:** 2026-07-09

## Summary

Added rewind (fast backward) and forward (fast forward) control buttons to the Video Player HUD, matching the Music Player HUD's control layout.

## Changes

### Video Player HUD Controls (7 total)

The HUD controls now include:
1. Play/Pause
2. Rewind (NEW)
3. Forward (NEW)
4. Previous
5. Next
6. Shuffle
7. Repeat

### Control Behavior

- **Rewind**: First press activates x2 speed rewind, subsequent presses cycle through x2, x4, x8, x16, x32
- **Forward**: First press activates x2 speed forward, subsequent presses cycle through x2, x4, x8, x16, x32
- Fast mode is cancelled when Play/Pause, Previous, or Next is pressed

### Layout Adjustments

To accommodate 7 controls (up from 5), the following layout changes were made:
- Control button size reduced from 100x100px to 80x80px
- Control gap reduced from 40px to 24px
- SVG icon size reduced from 80x80 to 56x56
- Fast speed text size: 1.8rem

## Files Modified

- `screens/app-usb.js`
  - Added `rewind` and `forward` cases to `getVideoPlayerIcon()`
  - Updated `renderVideoPlayer()` to include rewind/forward controls with fast mode display
  - Updated `handleVideoPlayerNav()` to allow navigation across 7 controls (index 0-6)
  - Updated `handleVideoPlayerOK()` to handle rewind (index 1) and forward (index 2) actions
  - Added `.vp-fast-speed` CSS class for speed indicator display
  - Adjusted `.vp-controls` gap and `.vp-ctrl-btn` dimensions for proper centering

## CSS Classes

- `.vp-fast-speed` - Speed indicator text (x2, x4, x8, x16, x32) shown when fast mode is active

## State Variables Used

- `videoPlayerFastMode` - `null` | `'rewind'` | `'forward'`
- `videoPlayerFastSpeed` - 0-4 (maps to x2, x4, x8, x16, x32)
