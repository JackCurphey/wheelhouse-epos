# Tasks

Each pull request: tests first, each watched failing for the right reason; `npm run lint`, `npm test` and `npm run test:browser` pass locally after merging main; a self-review, and `/review` with a hand-run CI (risky: migrations, money and stock).

## 1. The server (pull request 1; migration, stock)

- [x] 1.1 Tests (`tests/restock.test.js`, `tests/migration-123.test.js`): running low, below zero included, and off-sale left out; selling fast at 6 against 6 and not at 4 against 24; the suggested count (3 + 4 − 2 = 5); an order still to come taking a product off; a job's pads with none in stock on For customers with WH-1042, Maya Patel and the job's day, and off it once ordered for that job; stock going to the earlier job first; finished and pending jobs not counting; supplier matched by name ignoring capitals, an unknown name its own group, none under No supplier; Add to an order making a draft, then adding to it, keeping the job; the CSV's rows and headers, with a formula-looking name guarded; seen keys and the new count; Jo refused on every route; another business's products, jobs and orders never in it.
- [x] 1.2 Migration 123; `server/lib/restock.js`; `server/routes/restock.js` and its place in `server/routes/index.js` and the route list.
- [x] 1.3 An order line's job: `serializePurchaseOrder`'s `forJob`, and `PUT /api/purchase-orders/:id` keeping it.

## 2. The Restock list screen and the hub (pull request 2)

- [x] 2.1 Screen tests (`tests/screens/restock.test.js`): groups by supplier with the columns; pills, and `?show=` picking one; every line ticked, the group's tick, "[n] ticked"; the stepper never below 1; Download sending only the ticked lines at their counts; Add to an order sending a job's line with its job and opening the order; no Add to an order for a supplier not in the list, with the words; opening marks it seen; the hub's three lines and their links; the order page's "for job WH-1042"; Jo told it's the owner's.
- [x] 2.2 `restock-page.tsx`, its route; the hub's Restock list card; the order page's line.
- [x] 2.3 A browser test (`tests/browser/restock.spec.ts`): the Owner opens the list from Deliveries and orders, unticks one, adds the rest to an order, at computer and phone widths.

## 3. Today's line (pull request 3)

- [x] 3.1 Tests: `restock_new` in the Owner's needs-attention with its counts, gone once the list is opened or downloaded, back when something new comes on, each person's own; the screen's line and Open.
- [x] 3.2 `today.js` `restockNew()`; `today-page.tsx`'s line.
- [x] 3.3 Log every gap and default in Jack's section of `decided-while-building.md`; `/opsx:archive` as the last commit.
