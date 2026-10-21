# Tasks: one sales record in pence, and where open orders live

A step that changes how sales are read or written is not deployed while the totals check reports a mismatch that isn't one of its known kinds (`design.md` Decision 7).

Each group is about one pull request (aim: 250–600 changed lines). Group 1
merges before Jack's group 2 starts (split plan §4.3). Steps C, D and E
(`design.md` Decision 5) are built in later changes and are listed under
"Workflow follow-up" so nothing is lost.

## 1. Step A: orders in pence, and the totals check (Mark, server)

- [x] 1.1 Write the totals check tests first, and watch each fail because `scripts/ci/check-money-totals.mjs` doesn't exist. Use fixtures for:
  - each mismatch kind (conversion, order lines, sale lines, payments, days);
  - the two known kinds (group-discount rounding, the 1p tolerance);
  - a clean database.
- [x] 1.2 Write `scripts/ci/check-money-totals.mjs` (`design.md` Decision 7). Verify the 1.1 tests pass, and that a fresh test database reports no mismatches, with counts
- [x] 1.3 Write the migration test first, on a scratch database with pounds orders. Watch it fail, then write the migration (next free number) and verify the totals check is clean after it. The test checks that:
  - the new columns exist, as `INTEGER NOT NULL DEFAULT 0` (`vat_rate_bp` nullable);
  - amounts are backfilled with `ROUND(x * 100)`;
  - `paid_pence` equals the converted sale's total for converted orders;
  - `vat_rate_bp` comes from the product for product lines, and is empty for labour lines.
- [x] 1.4 Tests first for the sale-documents routes, `loadDocumentLine` and convert writing pence and pounds together (convert also setting `paid_pence` to the sale's total), and returning `…Pence` fields beside the pound fields, with statuses unchanged. Watch them fail, then build. Verify `saleDocuments` and `saleDocumentsConvertApi` pass unchanged apart from the new fields
- [ ] 1.5 Verify that `npm test`, `npm run test:browser` and the totals check pass, then get a fresh review against `specs/sales/spec.md` and the money contract

## 2. Step A′: workshop amounts in pence (Jack, workshop, after group 1 merges)

- [ ] 2.1 Jack's part of #134: move `workshop_services.price`, `workshop_quote_lines.unit_amount` and `.quantity`, and `workshop_job_services.booked_price` to pence under the money contract, and have quote approval (`answerAndAddToOrder`) write pence. Extend the totals check to them. Tests first
- [ ] 2.2 Replace the three JavaScript money sums (the quote approval total, `quote-panel.tsx`'s "Proposed total", `quote-card.tsx`'s customer total) with totals worked out on the server. Tests first
- [ ] 2.3 Update `openspec/specs/workshop-jobs/spec.md` where it describes amounts. Verify that `npm test`, `npm run test:browser` and the totals check pass, then get a fresh review. Mark approves the server changes

## 3. Step B: reports read both records (Mark, server)

- [ ] 3.1 Before anything changes, run the totals check on the hosted copy (or the test database, if the hosted copy isn't up yet) and save its per-day baseline. Attach the output to the pull request
- [ ] 3.2 Tests first for the `all_sales` view, and watch each fail. Then add the view in a migration and verify the tests pass. The tests check that:
  - a day with one old sale and one till sale counts two, with the right total;
  - an offline till sale counts on the day of `till_clock_at`;
  - old sale [n] and till sale [n] stay apart.
- [ ] 3.3 Tests first, then point the dashboard's today figures, `GET /api/sales`, `GET /api/sales/:id` (with a record, and old ids still working) and `GET /api/customers/:id/sales` at the view. Verify `till-sale-server`, `shop-day-window` and the dashboard tests pass
- [ ] 3.4 Run the totals check again after deploying. Verify old-record days match the 3.1 baseline and there are no unknown mismatches. Attach the output, then get a fresh review

## Workflow follow-up

- **Step C** (the new till onto sync) is in the send-queue part of WP-1.6's change.
- **Step D** (paying orders at the new till) is in WP-3.1's change, which follows `design.md` Decision 8. It needs Jack's yes to the two new "check these" kinds and his answer on labour VAT first.
- **Step E** (retiring the old writers, then dropping the old tables) follows rule 5 for each old screen. Dropping the tables needs Jack's yes.
- Archive this change as the last commit of the last pull request in groups 1–3, once both halves are in (split plan §4.3).
