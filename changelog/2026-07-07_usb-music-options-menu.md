# USB Media Player - Music Options Menu

**Date:** 2026-07-07

## Summary
Added Options menu for the Music category in USB Media Player. The menu provides Play All, Shuffle, and Repeat settings for music playback.

## Changes

### app-usb.js

#### New State Variables
- `musicOptionsEl` - DOM element for Options dialog
- `musicRepeatSubmenuEl` - DOM element for Repeat submenu dialog
- `musicOptionsIndex` - Current selection index in Options menu
- `musicShuffleOn` - Shuffle toggle state (default: false)
- `musicRepeatMode` - Repeat mode: 'play-once' (default) or 'repeat'
- `musicRepeatSubmenuIndex` - Current selection index in Repeat submenu
- `musicOptionsFromLeftPanel` - Whether Options was opened from left panel

#### New Views
- `music-options` - Options dialog view
- `music-repeat-submenu` - Repeat submenu view

#### New Functions
- `renderMusicOptions()` - Renders the Options dialog
- `renderMusicRepeatSubmenu()` - Renders the Repeat submenu
- `openMusicOptions(fromLeftPanel)` - Opens Options menu
- `closeMusicOptions()` - Closes Options menu
- `openMusicRepeatSubmenu()` - Opens Repeat submenu
- `closeMusicRepeatSubmenu()` - Returns to Options menu
- `confirmMusicRepeat()` - Selects repeat option (stays on page)
- `handleMusicOptionsOK()` - Handles OK on Options items
- `playAllMusic()` - Starts playback with current shuffle/repeat settings

#### Options Menu Items
- **Play All** (only when cursor on music file in right panel)
  - Starts playback from first track (or random if shuffle on)
- **Shuffle** - Toggle On/Off with visual switch indicator
- **Repeat** - Opens submenu with arrow indicator (>)

#### Repeat Submenu Items
- **Play Once** (default) - Play and stop
- **Repeat** - Loop all tracks

#### Navigation
Options page:
- UP/DOWN: Move between items
- OK/Enter: Select item (toggle Shuffle, enter Repeat submenu, or Play All)
- RIGHT: Enter Repeat submenu (when on Repeat item)
- BACK/OPTION: Close menu

Repeat page:
- UP/DOWN: Move between Play Once and Repeat
- OK/Enter: Select option (checkmark updates, stays on page)
- LEFT/BACK: Return to Options page

#### Trigger
- PC keyboard: Press `O` or `o`
- DEV PANEL: Press OPTION button
- Context:
  - On left panel (Music category): Shows Shuffle and Repeat only
  - On right panel (music file): Shows Play All, Shuffle, and Repeat

#### Styling
- Matches Music header style (golden yellow title #ffc239)
- Dark background matching app theme (#0d0f14, #11151c)
- Blue highlight for selected items (#3a86ff)
- Toggle switch for Shuffle (gray off, blue on)
- Checkmark for current Repeat selection

## Testing
- Smoke tests: 26 passed, 0 failed
