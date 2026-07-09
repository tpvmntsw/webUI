# Video Player Slide Show Speed Menu Fix

**Date:** 2026-07-09

## Summary

Fixed an issue where the Slide show speed menu would not appear when pressing Enter on the slide speed icon in the Video Player HUD, while the same action worked correctly in the Music Player HUD.

## Problem

When selecting the Slide show speed icon (index 8) in the Video Player HUD and pressing Enter, the speed selection menu did not appear. The same functionality worked correctly in the Music Player HUD.

## Root Cause

The DOM element order in `usb-fullscreen` container determined the stacking order of elements. Elements defined later in the DOM appear on top of earlier elements.

**Original order:**
```
music-player-view
photo-player-view
photo-slidespeed-menu
player-slidespeed-menu  <-- Slide speed menu
photo-player-info
video-info-dialog
video-player-view       <-- Video player was AFTER menu
```

Because `video-player-view` was defined after `player-slidespeed-menu`, the Video Player background would cover the Slide show speed menu, making it invisible.

Music worked correctly because `music-player-view` was defined before `player-slidespeed-menu`.

## Fix

Moved `video-player-view` to appear before the overlay menus in the DOM order:

**New order:**
```
music-player-view
photo-player-view
video-player-view       <-- Moved before menus
photo-slidespeed-menu
player-slidespeed-menu  <-- Now displays on top
photo-player-info
video-info-dialog
```

## Files Modified

- `screens/app-usb.js`
  - Reordered DOM elements in mount() function to ensure `player-slidespeed-menu` appears above `video-player-view`
