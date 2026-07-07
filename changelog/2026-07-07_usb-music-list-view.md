# USB Media Player - Music List View

**Date:** 2026-07-07

## Summary
Redesigned the Music category view in USB Media Player to use a list layout with an enlarged info panel on the right side, matching the reference design.

## Changes

### app-usb.js

#### Layout Changes
- Changed Music view from 4x3 grid layout to vertical list layout
- Header now uses same style as Videos/Photos (yellow title, no tabs)
- Removed Tracks/Albums/Artists/Genres tab row
- Info panel enlarged to approximately 2x size:
  - Panel width: 320px → 500px
  - Album art: 180x180 → 280x280
  - Filename font: 1.2rem → 1.6rem
  - Info row font: 1.1rem → 1.4rem
  - Increased padding and gaps

#### Content Changes
- Music view now shows only music files (no folders)
- Recursively collects all music files from all subfolders
- Files sorted alphanumerically (0-9, A-Z, a-z)
- Music note icon (♯) shown for each file instead of folder icons

#### Info Panel Behavior
- Info panel only displays when cursor is in the right panel (list)
- Info panel hidden when cursor returns to left category panel
- Shows: album art placeholder (music note SVG), filename, Duration, Artist, Album, Genre

#### New Functions
- `collectAllMusicFiles(categoryData)` - Recursively collects and sorts all music files
- `renderMusicListView()` - Renders the list-style music view
- `updateMusicListScrollOffset()` - Handles scrolling for music list

#### Navigation Updates
- `moveSelectionVertical()` - Single-item navigation for Music (not grid rows)
- `moveSelectionHorizontalInGrid()` - No horizontal movement in list view
- `moveLeft()` - Goes directly to left panel for Music category
- `loadCategoryContent()` - Special handling for Music to collect all files

#### Removed
- `MUSIC_TABS` variable
- `selectedMusicTab` variable
- Tab-related CSS styles

## Testing
- Smoke tests: 26 passed, 0 failed
