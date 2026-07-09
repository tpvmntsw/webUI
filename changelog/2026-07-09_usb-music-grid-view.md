# USB Music - Grid View Display

**Date:** 2026-07-09

## Summary

Changed Music category display from the special list view (left list + right info panel) to the standard grid view used by Photos and Videos (4x3 grid with folders and files). Also unified navigation behavior with Videos/Photos.

## Changes

### Display Mode

**Before:**
- Music used a special two-panel layout:
  - Left panel: vertical list of music files only
  - Right panel: info display (album art, duration, artist, album, genre)
- Navigation was single-item (UP/DOWN moved one item)
- LEFT always returned to parent folder or left panel

**After:**
- Music now uses the same 4x3 grid layout as Photos and Videos
- Shows both folders and music files with appropriate icons
- Folders display folder icon (&#128193;)
- Music files display music note icon (&#127925;)
- Navigation is grid-based (UP/DOWN moves by row, LEFT/RIGHT moves by column)

### Navigation Behavior (unified with Videos/Photos)

- **UP/DOWN**: Move by row (4 items per row)
- **LEFT**: Move left in grid; at leftmost column, go to parent folder or left panel
- **RIGHT**: Move right in grid; at rightmost column, stop
- **OK**: Enter folder or play music file
- **BACK**: Return to parent folder or left panel

### INFO Key Behavior

When the cursor is on a music file and INFO key is pressed:
- Displays "Music metadata" dialog with:
  - Album
  - Title
  - Bit Rate
  - Artist
  - Sampling
  - Year
  - Size

This matches the behavior of Photos (Picture metadata) and Videos (Video metadata).

### Mock Data Enhancement

Added more folders to simulate realistic USB content:
- Albums (Rock Classics, Jazz Collection, Pop Hits 2024, Electronic Mix, Classical Masterpieces, Country Roads)
- Artists (The Beatles, Taylor Swift, Ed Sheeran, Adele)
- Playlists
- Podcasts (Tech Talk, Daily News, Science Hour)
- Audiobooks (Fiction, Non-Fiction)
- Recordings (Voice Memos)
- Downloads
- Favorites

## Files Modified

- `screens/app-usb.js`
  - Removed the special case that called `renderMusicListView()` for Music category
  - Removed `isMusicCategory()` checks from navigation functions
  - Unified `moveSelectionVertical()` to use grid-based navigation for all categories
  - Unified `moveSelectionHorizontalInGrid()` for all categories
  - Unified `moveLeft()` for all categories
  - Unified `enterFolder()` to use `scrollRowOffset` for all categories
  - Expanded Music mock data with more folders and subfolders

## User Flow

1. Navigate to Music category in USB Media Player
2. Browse folders and music files in 4x3 grid view
3. Use UP/DOWN to move by row, LEFT/RIGHT to move by column
4. Press OK on folder to enter
5. Press OK on music file to play
6. Press INFO on music file to view metadata
7. Press OPTION to access Music Options menu
8. Press LEFT at leftmost column or BACK to return to parent folder
