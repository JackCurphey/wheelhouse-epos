# Tasks

- [x] 1.1 Tests first, each watched failing:
  - migration 090 from empty (`tests/migration-090.test.js`);
  - server (`tests/purchase-orders-receive.test.js`): staff can receive;
    stock and arrived counts; problems recorded and not in stock; too many
    refused; two bookings of the last item at once count once;
  - screen (`tests/screens/receive-delivery.test.js`): the hub's Receive a
    delivery, the order's Receive against this order, scanning, counts,
    not on the order, Problem?, Book in;
  - browser (`tests/browser/receive-delivery.spec.ts`): scan the pads in and
    book them in, at computer and phone widths, nothing scrolling sideways.
- [x] 1.2 Build the contract, migration and screens 1–8; log the choices in
  `docs/decisions/decided-while-building.md`.
- [x] 1.2a Second review (26 Oct), tests first, each watched failing:
  damaged and wrong items set aside in earlier deliveries count against
  the line, and an order with nothing left to come is received; stock
  updated in product order (two deliveries in opposite orders both land);
  "This order is all in." instead of moving to another order; a refused
  booking refreshes the orders; a problem undone with − at 1 in "Problem?".
  Logged in `decided-while-building.md` (receiving, item 9).
- [ ] 1.3 Lint, the touched tests, `/review` (stock, migration), pull
  request, archive.
