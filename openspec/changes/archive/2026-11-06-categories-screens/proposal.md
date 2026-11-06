## Why

Stock control decision 10 has each category hold its own details, set in Settings › Stockroom › Categories. Piece 4 (`category-tree`) built the tree, its details and the server behind it; nothing on screen uses it yet. WP-1.5, piece 8 (`openspec/changes/wp-1-5-products/tasks.md`; WP-2.1): the screens `st-categories` and `st-category-edit`, the first of the product screens, which Jack put before piece 7 (`docs/decisions/2026-11-04-answers.md` answer 11).

## What Changes

- Settings › Stockroom gains the Categories fold after Stock adjustments, with the drawn intro "Stock adjustments, and each category’s details." and summary "Bearings, Drivetrain › Derailleurs and [n] more".
- The fold lists each category, one inside another set in with "↳", its details on one line, and Edit; "+ Add a category" and the drawn note.
- The edit box, as drawn: where it sits (a combobox picked by typing and the arrow keys), what it has from above with "Change it on [parent]", its own details with their kind, choices taken off and added, a removed detail struck through with Undo until Save, Add a detail asking for a unit or choices by kind, and the note saying how many products lose a removed detail.
- "+ Add a category" opens the same box empty, titled "Add a category", with a Name field (not-drawn pages, row 18, option B).
- Answer 11 recorded, and piece 7 marked as waiting in the split plan.

## Out of scope

Renaming a category on screen and deleting one (neither drawn; the server can rename). A product's answers on its page (piece 10), the Stock list's category filters (piece 9), Citrus Lime's sizes (piece 7, waiting).

## Who and risk

WP-1.5, piece 8, Jack's side. Screens only: no migration, no server change, no money or stock. Settings stays the Owner's, as it is; the server already refuses anyone else.

## Follows

- Decisions: `docs/decisions/2026-10-01-stock-control-review.md` 10 and 11 (audit H4: the box asks for what each kind needs; audit M15: a removed detail can be undone until Save, which says what goes); `docs/decisions/2026-10-08-not-drawn-pages.md` row 18; `docs/decisions/2026-11-04-answers.md` answer 11.
- Drawings: `st-categories`, `st-category-edit` (`docs/design/user-journeys/generator/stock.mjs`, `settings-frame.mjs`).
- Server: `openspec/changes/archive/2026-11-05-category-tree/design.md` section 5.

## Capabilities

### New Capabilities

### Modified Capabilities
- `stock`: the Categories screens in Settings.

## Impact

New `src/screens/settings/categories-settings.tsx`; `src/screens/settings/settings-page.tsx`. Tests: `tests/screens/settings-categories.test.js`, `tests/browser/settings-categories.spec.ts`.
