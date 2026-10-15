# Tasks: stock changes push to Shopify after the request lets go of its connection

## 1. Push after release

- [ ] 1.1 Write `tests/stock-shopify-push-after-release.test.js` first. For a stock adjustment and for booking in a purchase order, against a fake Shopify domain, the reply comes before the push's failure line, and the push is still attempted. Watch both fail in CI ("the reply waited for the Shopify push"), since this Mac has no Postgres
- [ ] 1.2 Add `deferShopifyPushes` to `server/lib/sales.js` and use it in both routes. Verify the 1.1 tests pass in CI, along with the existing `sale-shopify-push-*` tests
- [ ] 1.3 Verify that `npm test` and `npm run test:browser` pass in CI on the final commit, then get a fresh review

## Workflow follow-up

- Archive as the last commit, then merge once CI is green on it.
