# USB Media Player - Options Menu Style Update

**Date:** 2026-07-07

## Summary
Updated Music Options Menu and Repeat submenu styling to match Info Menu design, with background blur effect when opened.

## Changes

### app-usb.js

#### Options Menu (.music-options, .music-opt-dialog)
- Background color changed to match Info Menu (`#4a5568`)
- Border style updated (`3px solid #718096`, border-radius `16px`)
- Added backdrop blur effect (`backdrop-filter:blur(8px)`) when menu is open
- Title color changed to gold (`#ffc239`) to match Music header
- Menu items styled with gray background (`#5a6578`) and rounded corners

#### Repeat Submenu (.music-repeat-submenu, .music-repeat-dialog)
- Same styling updates as Options Menu
- Title "Options / Repeat" now uses gold color (`#ffc239`)
- Added backdrop blur effect when submenu is open
- "Play Once" text changed to "Play once"

#### Info Dialog (.usb-video-info-dialog)
- Title color changed to gold (`#ffc239`) for consistency with Music header

## Visual Behavior
- When Options Menu opens: background split view becomes blurred
- When Options Menu closes: background returns to normal (blur removed)
- Menu position remains at top-left corner (unchanged from original)

## Testing
- Navigate to USB Media Player > Music category
- Press `O` key to open Options Menu
- Verify background blur and menu styling
- Navigate to Repeat submenu and verify same styling
