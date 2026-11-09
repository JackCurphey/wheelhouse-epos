# Tasks

Each pull request: tests first, each watched failing for the right reason; `npm run lint`, `npm test` and `npm run test:browser` pass locally after merging main; a self-review, and `/review` with a hand-run CI (risky: a migration, stock).

## 1. The server (pull request 1; migration, stock)

- [ ] 1.1 Tests (`tests/stock-frames.test.js`, `tests/migration-125.test.js`): which categories are bikes; booking in three bikes with frames records them, in stock, at the shop, with the delivery and who; a bike without frames, too few, one twice, one already in stock (with its date), a non-bike with frames, each refused with nothing booked in; a frame number compared without capitals and spaces; the check route; a product's page sends its frames, in stock first, and each received line its delivery and frame count; Stock's row its frames in stock; another business's frames never seen or clashing; sent twice with its request key books once; the old route still books a bike in; the migration from empty, its clash index, and run twice.
- [ ] 1.2 Migration 125; `server/lib/bikes.js`; `isBike` on a product; booking in's frames; `server/routes/stock-frames.js`; a product's page and Stock's row; the route list.

## 2. The screens (pull request 2)

- [ ] 2.1 Screen tests (`tests/screens/receive-frames.test.js`, `tests/screens/stock-list.test.js`): scanning a bike opens Frame number with its words; Enter counts; Cancel doesn't; in stock and in this delivery each warned and not counted; the line's frames; no stepping up, stepping down takes the last; Book in sends the frames, leaving out set aside; a bike's page lists its frames and the received line; Stock's line.
- [ ] 2.2 `frame-number.tsx`; `receive-page.tsx`; `product-page.tsx`; Stock's line.
- [ ] 2.3 A browser test (`tests/browser/receive-frames.spec.ts`): Jo receives two bikes by frame number, the Owner opens the bike's page and sees them, at computer and phone widths.
- [ ] 2.4 Log every gap in Jack's section of `decided-while-building.md`; `/opsx:archive` as the last commit.
