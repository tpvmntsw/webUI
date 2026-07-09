# Unified Media Options Menu

**Date:** 2026-07-09

## Summary

Consolidated Videos, Photos, and Music Options menus into a single unified Media Options menu. The menu is now centered on screen (like Info Menu) and provides shared settings across all media types.

## Changes

### Unified Options Menu

All three media categories (Videos, Photos, Music) now share the same Options menu with 4 items:

1. **Play all** - Plays all files in current folder (behavior depends on current category)
2. **Shuffle** - Toggle on/off (default: Off) - shared across all categories
3. **Repeat** - Toggle on/off (default: On) - shared across all categories  
4. **Slide show speed** - Fast/Medium/Slow (affects Photos playback only)

### Removed Features

- **List/Thumbnails** option - removed (always uses grid view)
- **Info** option from Options menu - removed (use INFO key instead)
- Separate repeat submenus - replaced with simple on/off toggle
- Category-specific Options menus (music-options, photo-options, video-options)
- All viewmode submenus
- All repeat submenus

### UI Changes

- Options menu now displays **centered on screen** (like Info Menu)
- Uses same dialog style as Info Menu
- Backdrop blur effect

### State Variables

New unified state variables:
- `mediaOptionsEl` - DOM element
- `mediaOptionsIndex` - Selected menu item index
- `mediaShuffleOn` - Shared shuffle setting (default: false)
- `mediaRepeatOn` - Shared repeat setting (default: true)
- `mediaSlideSpeed` - Shared slide speed: 'fast' | 'medium' | 'slow' (default: 'fast')

Removed variables:
- All category-specific options variables (musicOptionsIndex, photoOptionsIndex, videoOptionsIndex, etc.)
- All category-specific shuffle/repeat variables
- All viewmode variables (photoViewMode, videoViewMode)

### Play All Behavior

When "Play all" is selected from Options:
- **Videos**: Plays all video files in current folder
- **Photos**: Plays all photo files as slideshow (was "Slide show")
- **Music**: Plays all music files in current folder

### Files Modified

- `screens/app-usb.js`
  - New unified state variables
  - New `renderMediaOptions()` function
  - New `renderMediaSlidespeedSubmenu()` function  
  - New `openMediaOptions()`, `closeMediaOptions()` functions
  - New `handleMediaOptionsOK()` function
  - New `playAllMusicFromOptions()` function
  - Updated player open functions to use unified settings
  - Simplified onNav handling for options
  - Removed all category-specific options functions
  - Updated CSS for centered dialog
  - Removed unused CSS classes

## CSS Classes

New:
- `.media-options` - Main options overlay (centered)
- `.media-opt-dialog` - Dialog container
- `.media-opt-item` - Menu item
- `.media-opt-toggle` - Toggle switch
- `.media-slidespeed-submenu` - Speed submenu overlay
- `.media-speed-*` - Speed submenu classes

Removed:
- `.music-options`, `.music-opt-*`, `.music-repeat-*`
- `.photo-options`, `.photo-opt-*`, `.photo-submenu*`
- `.video-options`, `.video-opt-*`, `.video-submenu*`
