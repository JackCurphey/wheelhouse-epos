# Tasks

Jack's answers of 11 Nov are folded in (`docs/decisions/2026-11-11-settings-rest-answers.md`).

**For every pull request:**
- Write the tests first, and watch each fail for the right reason: break the code it covers, see it go red, restore it, and check the break really landed.
- After merging main, `npm run lint`, `npm test` and `npm run test:browser` pass locally, through `npm run full-check`.
- Self-review against these specs and the drawings (`setup.mjs`, `till.mjs`) with the `reviewer` agent.
- In a risky area, also run `/review` and the `risky-area-reviewer` agent, and do a hand-run CI (`gh workflow run test.yml --ref <branch>`).
- Each gap decided while building goes in your own month's file in `docs/decisions/decided-while-building/`.
- Server tests pin the clock to 1 Sep 2026.
- Compare DOM query results with `assert.ok(x === null)`.
- Aim for 250–600 changed lines.

**Order:** PR 2 needs PR 1, and PR 3 needs PR 2. PRs 4 and 5 stand alone.

## 1. Quick buttons on the server (PR 1, about 450 lines; migration, a risky area)

- [ ] 1.1 Write the migration tests first (`tests/quick-buttons.test.js`). They cover:
  - The migration runs from empty on a scratch database.
  - A button must have exactly one of a product or a service.
  - Removing a group removes its buttons.
  - Another shop's groups and buttons are never seen.
  - An existing shop's active services are copied into a "Workshop" group in the till's current order; inactive services are not; a shop with no services gets no group (Jack's answer 1).

  Verify: each fails first.
- [ ] 1.2 Add `server/migrations/130_quick_buttons.sql` (or the next free number), with row-level security. Verify: 1.1 passes.
- [ ] 1.3 Write the route tests first. They cover:
  - `GET /api/quick-buttons` gives groups and buttons in order, with each item's current price and `onSale`.
  - A product's new price shows on its button.
  - Add, rename, move and remove a group. A taken name is refused (409). Removing a group with buttons returns 409 `has_buttons` with a count until confirmed.
  - Add, change, move and remove a button. Moving keeps positions whole and in order when two moves land at once.
  - Staff are refused changes (403) but can read. Signed out gets 401.

  Verify: each fails first.
- [ ] 1.4 Add `server/routes/quick-buttons.js`, with `// screens: set-till-quick, set-till-quick-add, set-till-quick-saved, set-till-empty`, and list it in `server/routes/index.js`. Verify: 1.3 passes.

## 2. The Quick buttons fold (PR 2, about 550 lines)

- [ ] 2.1 Write the tests first (`tests/screens/quick-buttons-settings.test.js`, `tests/browser/settings-quick-buttons.spec.ts`). They cover:
  - Front desk › Till shows the Quick buttons fold with its summary.
  - The group pills, the rows with name, line and price, and the note.
  - Hover shows Edit and Remove. Right-click does too.
  - A handle moved with the arrow keys saves, with Undo.
  - Add a quick button: search, pick, name filled in, group pills, Cancel, and "Add the button" giving "Saved · Shimano brake pads added to Workshop". Nothing picked is refused beside the search.
  - Edit saves.
  - Remove and Undo puts the button back in place.
  - Add a group.
  - The empty state and "None yet".
  - A failed save shows "Not saved — no internet connection. Your change is kept here."
  - On a phone the rows and pills wrap.

  Verify: each fails first.
- [ ] 2.2 Add `src/screens/settings/quick-buttons-settings.tsx` (the fold, the Add/Edit box, the group box), with the fold added to `OwnerSettings()`'s Till area. Verify: 2.1 passes.

## 3. Quick buttons on the till (PR 3, about 250 lines; waits for Mark's yes, because it edits `till-page.tsx`)

- [ ] 3.1 Write the tests first (`tests/screens/till-quick-buttons.test.js`, `tests/browser/till.spec.ts`). They cover:
  - The till shows the shop's group pills and the first group's buttons in order.
  - A tap adds the item at its current price.
  - Another pill shows its buttons.
  - An off-sale item doesn't show.
  - No buttons shows "No quick buttons yet. Add them in Settings."
  - 4, 3 and 2 columns on a computer, tablet and phone.
  - The existing till screen tests still pass unchanged.

  Verify: each fails first.
- [ ] 3.2 Change the left side of `src/screens/till/till-page.tsx`. `add()` and the payment steps are not changed. Remove the header comment's "quick button groups" line. Verify: 3.1 passes.

## 4. End of day: Close the day timing and Count first (PR 4, about 450 lines; migration, a risky area)

- [ ] 4.1 Write the tests first (`tests/close-entry.test.js`, `tests/end-of-day-settings.test.js`). They cover:
  - `entryFor` with 0, 30 and 60 minutes, around a 17:30 close.
  - Shut today means all day. Closed means not shown.
  - The migration gives a new shop 30 minutes and Count first on, and moves existing shops to 30 minutes too (Jack's answer 2).
  - `/api/end-of-day-settings` saves both settings, refuses other values (400), refuses Staff (403), and keeps both when two saves land at once.
  - `GET /api/close-the-day` sends `countFirst`.

  Verify: each fails first.
- [ ] 4.2 Add the migration (two columns on `shops`), update `server/lib/close-entry.js` and `server/routes/shop-settings.js`, and add `countFirst` in `server/routes/close-the-day.js`'s GET. Verify: 4.1 passes.
- [ ] 4.3 Write the tests first (screen and browser). They cover:
  - The Close the day fold's three choices, note, "Change opening hours", summary, Saved · Undo, and the failed save.
  - The Counting the cash fold's switch and its summary.
  - With Count first off, Close the day shows the expected amount and a live difference. With it on, as before.
  - The existing close-the-day tests still pass.

  Verify: each fails first.
- [ ] 4.4 Add the folds in `src/screens/settings/end-of-day-settings.tsx` and `OwnerSettings()`, and the counting step in `src/screens/till/close-the-day.tsx`. Verify: 4.3 passes.
- [ ] 4.5 Log the gaps from `design.md` section 5 (point 1).

## 5. Ways to pay: Cash and Other ways to pay (PR 5, about 350 lines; migration, a risky area)

- [ ] 5.1 Write the tests first (`tests/payment-ways-other.test.js`). They cover:
  - The migration seeds Finance, Cycle to Work and Payment link with their lines for every shop.
  - GET lists them in order.
  - POST adds at the end. A name already on the list is refused, and so is one over 30 characters.
  - DELETE removes. Undo re-adds in place.
  - Staff are refused changes. Another shop's list is never seen.

  Verify: each fails first.
- [ ] 5.2 Add the migration and routes in `server/routes/customer-money.js`. Verify: 5.1 passes.
- [ ] 5.3 Write the tests first (screen and browser). They cover:
  - Ways to pay shows Cash first, "Always on", with no switch, and no Card, Gift cards or Deposits switches (Jack's answer 3).
  - The Other ways to pay fold shows the rows, Remove, the Add box and the note, with Saved · Undo and the summary.
  - Take payment is unchanged.

  Verify: each fails first.
- [ ] 5.4 Add the Cash card in `ways-to-pay-settings.tsx`, add `src/screens/settings/other-ways-to-pay.tsx`, and add the fold in `OwnerSettings()`. Verify: 5.3 passes.

## 6. Finish

- [ ] 6.1 Update the build board's hand-written WP-1.3 and WP-5.1 lines, and STATUS's "Start here", in the last pull request.
- [ ] 6.2 Run `/opsx:archive` as the last commit of the last pull request, before it merges.
