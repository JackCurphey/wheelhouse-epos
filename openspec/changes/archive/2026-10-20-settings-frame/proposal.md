# The Settings frame: rooms, folds, Jump to (WP-1.3, first part)

## Why
Settings is one long page; the drawings (`docs/design/user-journeys/generator/settings-frame.mjs`, Owner setup decisions 3, 17 and 21) show rooms down the left, each room's areas with Jump to, and each area's settings as folds with a one-line summary, and on a phone a list of rooms first. WP-1.3 (build plan) is Jack's; its "Saved · Undo" and Quick buttons need Mark's WP-1.2 (the change record and the quick buttons' store), so this first part builds the frame only. Jack, 20 Oct: carry on with it after the pill keys.

## Drawings
`set-list` (the phone's rooms), the room pages and their folds (`settingsPage`, `fold` in `settings-frame.mjs`; e.g. `set-shop-details`, `set-shop-hours`, `set-msg-list`, `bk-settings`, `set-workshop-sign-off`).

## What changes
- `src/screens/settings/settings-frame.tsx`: the rooms nav, the room page (heading, intro, Jump to when a room has more than one area, area headings), folds, the phone's room list and "‹ Settings". Rooms are addressed `/workshop/settings?room=front-desk|workshop|office`.
- The built settings move into their drawn rooms: Front desk › Till › Receipts, Front desk › Messages › Automatic messages, Workshop › Online booking and Mechanics, Office › Shop and sites › Shop details and Opening hours. Stockroom has nothing built, so it isn't listed (stage 1 drawing gaps decision 6).
- Each fold's summary says only what's set up (setup audit H3, M2).
- Screens only; the boxes inside are unchanged.

## Not in this change
"Saved · Undo" and the failed-save note (WP-1.3 block 10, needing Mark's change record for Undo), and Quick buttons (needing his store).

## Impact
`src/screens/settings/settings-frame.tsx` (new), `settings-page.tsx`, `messages-settings.tsx`; tests `tests/screens/settings-frame.test.js` (new), `settings-page.test.js`, `settings-messages.test.js`, and the browser tests that open Settings.
