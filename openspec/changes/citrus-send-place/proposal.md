WP: none

# Proposal: A shop's next Citrus Lime file is taken as soon as the last is answered

## Why

`tests/citrus-import.test.js` sends twelve files one after another and expects the first ten to be taken. On a busy Mac it sometimes got "Wheelhouse is still taking in another of your files" (429 `busy`) for one of the first ten (the Front desk session's list of tests that fail only under load, 11 Nov).

The cause is in the app, not the test. A shop may send one file at a time: each send holds the whole file in memory (`server/routes/move.js`, `sendingShops`, archived `citrus-import-products` design 13). The send takes the shop's place in `beforeBody`. `server/server.js` gives the place up in its `finally`, but only after the handler has answered and `runWithShop` has handed this request's database connection back, which is a round trip later. A shop's next file, sent as soon as the last one was answered, could land in that gap and be told the shop was busy. The page sends files one after another, so a real owner dropping several files at once could see a file refused for nothing on a slow server.

## Work package, who, risky areas

- **WP:** none (a fix to WP-2.4's import, found by the flaky-test work).
- **Taken by:** the fix-tests session (Jack's Mac), overnight 11 to 12 Nov.
- **Risky area:** treated as **money and stock**. `move.js` itself writes no stock, but the files it takes are what `server/move/bring-across.js` turns into products and `stock_qty`. So it gets `/review`, the risky-area reviewer and a hand-run CI.
- Not a small piece by the rule's letter (it is under 200 lines, but in a risky area), so this is the full version.

## What Changes

- The send gives up the shop's place **just before it answers**, whatever the answer is: taken (202), can't read (422), busy queue (429), reused key (409), or a refused request (400).
- The place remembers **which send holds it**. The late let-go from `server.js` still runs, but it frees the place only if the same send still holds it, so it can't free the place a following send has just taken.
- A send that fails with an error still gives the place up in `server.js`'s `finally`, as before.

## Out of scope

- How many files may wait to be read (`MAX_WAITING_A_SHOP`, still 10).
- The page's own retry on 429.
- The other flaky tests fixed in the same pull request (messaging-engine's wait and delete-account's lock wait). They change test files only and need no spec.

## Drawings and decisions followed

- `mv-progress` (progress while files come across); `moving.mjs`. No screen changes.
- Archived `citrus-import-products` design 13 (one send at a time per shop).
- `docs/decisions/2026-11-11-speeding-up-the-build.md` (full runs through `npm run full-check`).
