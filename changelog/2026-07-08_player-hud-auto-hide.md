# Player HUD Auto-Hide Feature

**Date:** 2026-07-08

## Summary

Added auto-hide functionality for the HUD (Head-Up Display) in Music Player and Photo Player screens.

## Changes

### New Behavior

1. **Initial Display**: When entering Music Player or Photo Player (via Play or Play All), the HUD is shown initially.

2. **Auto-Hide**: After 5 seconds without any key input, the HUD automatically hides.

3. **Enter/OK/Play/Pause Keys**:
   - If HUD is hidden: Shows the HUD with 5-second auto-hide timer
   - If HUD is visible: Restarts the 5-second auto-hide timer and performs the control action (OK only)
   - PLAY/PAUSE always affect playback state regardless of HUD visibility

4. **INFO Key (i/I/INFO)**:
   - If HUD is visible: Immediately hides the HUD
   - If HUD is hidden: Immediately shows the HUD in "locked" mode (no auto-hide)
   - When HUD is locked (shown via INFO), it stays visible until:
     - INFO is pressed again (hides immediately)
     - Enter/OK/PLAY/PAUSE is pressed (switches to auto-hide mode with 5-second timer)

5. **LEFT/RIGHT Navigation**: Only works when HUD is visible (to move between control buttons)

### Files Modified

- `screens/app-usb.js`:
  - Added HUD visibility state variables for both players
  - Added HUD timer management functions
  - Modified `renderMusicPlayer()` to conditionally render HUD
  - Modified `renderPhotoPlayer()` to conditionally render HUD
  - Modified `handleMusicPlayerNav()` to handle INFO key and HUD logic
  - Modified `handlePhotoPlayerNav()` to handle INFO key and HUD logic
  - Modified `openMusicPlayer()` and `openPhotoPlayer()` to initialize HUD state
  - Modified `closeMusicPlayer()` and `closePhotoPlayer()` to clean up HUD timers

### Technical Details

- `HUD_AUTO_HIDE_DELAY`: 5000ms (5 seconds)
- HUD state variables:
  - `musicPlayerHudVisible` / `photoPlayerHudVisible`: Boolean for visibility
  - `musicPlayerHudTimer` / `photoPlayerHudTimer`: Timer ID for auto-hide
  - `musicPlayerHudLocked` / `photoPlayerHudLocked`: Boolean for "locked" mode (shown by INFO, no auto-hide)
