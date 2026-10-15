# Tasks: stock changes push to Shopify after the request lets go of its connection

## 1. Push after release

- [x] 1.1 Wrote `tests/stock-shopify-push-after-release.test.js` first. For a stock adjustment and for booking in a purchase order, against a fake Shopify domain, the reply comes before the push's failure line, and the push is still attempted. Both failed in CI with "the reply waited for the Shopify push", and nothing else failed (run 38736675688; this Mac has no Postgres)
- [x] 1.2 Added `deferShopifyPushes` to `server/lib/sales.js` and use it in both routes. Verify the 1.1 tests pass in CI, along with the existing `sale-shopify-push-*` tests
- [x] 1.3 A fresh review found no P1 or P2 problems. The handlers get the dispatcher's `afterRelease` and `shopId` inside the push-slot cleanup, the same data is pushed, and the test can't pass if the push never happens. CI on the final commit (`npm test` and `npm run test:browser`) is the merge gate

## Workflow follow-up

- Archive as the last commit, then merge once CI is green on it.
