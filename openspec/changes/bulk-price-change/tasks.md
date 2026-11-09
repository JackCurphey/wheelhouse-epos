# Tasks

Each pull request: tests first, each watched failing for the right reason; `npm run lint`, `npm test` and `npm run test:browser` pass locally after merging main; a self-review, and `/review` with a hand-run CI (risky: a migration, money).

## 1. The server (pull request 1; migration, money)

- [x] 1.1 Tests (`tests/bulk-prices.test.js`, `tests/migration-124.test.js`): +10% ending .99 takes £28.00 to £30.99; £30.80 and £30.40 round to £30.99 and £29.99, and to £31.00 and £30.00 ending .00; £0.00 stays, £0.10 never rounds to nothing; −10% and Leave as they are; a target margin with VAT, and a product with no cost kept with noCost; a new price for each; below cost; a product with sizes ticked as one bringing every size; another business's product and an off-sale one left out; a rule past the most a price can be refused; preview changes nothing; the change writes the prices, one history line each with the batch and who, and nothing for an unchanged one; "None of these prices would change"; Undo puts them back with their own lines, leaves an edited one and counts it, and refuses a second Undo; Jo refused on all three; a held product answers busy and changes nothing; the migration from empty and run twice.
- [x] 1.2 Migration 124; `server/lib/bulk-prices.js`; `recordPriceChanges`'s batch; `server/routes/bulk-prices.js`, its place in `server/routes/index.js` and the route list.

## 2. Ticking and Change prices on Stock (pull request 2)

- [x] 2.1 Screen tests (`tests/screens/change-prices.test.js`): tick boxes and Tick all for the Owner, none for Jo; "[n] ticked", Untick all; ticks kept through a search; the dialog's title and "[n] products from [Supplier]"; the three ways, the ending hidden for A new price for each; the preview's Now, New, Below cost, Margin; typing a new price; "Change [n] prices" and greyed "Nothing would change"; pressing it sends the rule, clears the ticks and says "Prices changed · 3 products" with Undo; Undo's words, with "changed since"; the phone's stacked list.
- [x] 2.2 `change-prices.tsx`; ticking and the bar in `stock-page.tsx`.
- [x] 2.3 A browser test (`tests/browser/change-prices.spec.ts`): the Owner ticks products, changes them by a percentage, sees the new prices on Stock, and undoes it, at computer and phone widths.
- [x] 2.4 Log every gap in Jack's section of `decided-while-building.md`; `/opsx:archive` as the last commit.
