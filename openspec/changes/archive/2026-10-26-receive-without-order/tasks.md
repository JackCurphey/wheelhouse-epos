# Tasks

- [x] 1.1 Tests first, each watched failing:
  - migration 094 from empty, and again (`tests/migration-094.test.js`);
  - server (`tests/deliveries-receive.test.js`): staff receive with no
    order and with no supplier; who is recorded; a delivery mixing an
    order's line and one not on an order; damaged or wrong not on an order
    recorded with the supplier, not in stock; Missing not on an order, an
    unknown product or supplier, another supplier's order refused; two
    deliveries in opposite product orders both land; the order route
    records who too;
  - screen (`tests/screens/receive-delivery.test.js`): supplier pills, a
    scan not on an order, Problem? without Missing, one Book in for both;
  - browser (`tests/browser/receive-delivery.spec.ts`): a delivery with no
    order booked in, at computer and phone widths.
- [x] 1.2 Migration 094, the shared booking code and the new route; route
  list snapshot and owner-only allow-list.
- [x] 1.3 The screen (design 1–7); log the choices in
  `docs/decisions/decided-while-building.md`.
- [x] 1.4 Break each stock rule on purpose and watch its test fail; lint,
  `npx tsc --noEmit`, the touched tests.
- [x] 1.5 `/review` 26 Oct: nothing serious for stock; three fixes done (tests
  first, each watched failing): From set once when suppliers and orders load;
  a scanned line whose order line has gone becomes not on an order on a
  refresh; a problem's count capped at 100000 (400). Also: no supplier with
  an order line says "Pick the supplier this order is from." Logged in
  `decided-while-building.md` (item 8).
- [x] 1.6 Pull request, archive.
