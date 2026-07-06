# USB Media Player - Music Info Dialog

**Date:** 2026-07-06

## Summary
Added INFO dialog support for Music category in USB Media Player, matching the Video Info dialog style.

## Changes

### app-usb.js
- Added `isMusicFile()` function to detect music file extensions (mp3, wav, flac, aac, ogg, wma)
- Added `generateMockMusicInfo()` function to generate mock metadata:
  - Album
  - Title
  - Bit Rate
  - Artist
  - Sampling
  - Year
  - Size (Kbytes)
- Extended `showVideoInfo()` to support Music category
- Extended `renderVideoInfo()` to render Music metadata dialog with same OSD style as Video Info

## Usage
1. Navigate to USB Media Player > Music category
2. Select a music file in the right panel
3. Press `i`/`I` on PC keyboard or INFO button on DEV PANEL
4. Music metadata dialog appears with album, title, bitrate, artist, sampling, year, and size

## Testing
- Smoke tests: 26 passed, 0 failed
