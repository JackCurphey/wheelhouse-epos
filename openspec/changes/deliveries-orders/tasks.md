# Tasks

- [x] 1.1 Tests first, each watched failing:
  - server: the four writing routes refused for a staff member and not for
    the Owner (`tests/owner-only-routes.test.js`, with `purchase-orders.js`
    in its scan and `receive` on its allow-list); `totalCost` on an order;
  - screen (`tests/screens/deliveries.test.js`): the hub as Owner, empty
    and as staff; New order (pills, scan, count, total, Save as draft, Mark
    as ordered); an order (lines, tags, total, Close asks first, no Close
    once something has arrived or for staff);
  - browser (`tests/browser/deliveries.spec.ts`): make an order and mark
    it ordered, at computer and phone widths, nothing scrolling sideways.
- [x] 1.2 Build the contract and design 1–4 and 6; log the choices in
  `docs/decisions/decided-while-building.md`.
- [ ] 1.3 Lint, `npm test`, `npm run test:browser`, `/review` (money and
  stock), pull request, archive.
