# Tasks

Three stacked pull requests, to keep each near 250-600 changed lines.

## 1. Asking and cancelling (`jack/delete-account-ask`, stacked on #589)

- [x] 1.1 Tests first: migration 109 from empty and run twice (`tests/migration-109.test.js`); asking and cancelling (`tests/delete-request.test.js`: once, twice at once, with a bike in, cancel and ask again, signed out, another shop and another website refused). Watch each fail
- [x] 1.2 Migration 109; `openDeletion` in `server/privacy-requests.js`; the two routes and `/me`'s `deletion` in `server/routes/portal.js`
- [x] 1.3 Break each rule on purpose, see its test go red, and restore

## 2. The shop's list and deleting someone's details (`jack/delete-account-server`, stacked on 1)

- [x] 2.1 Tests first (`tests/delete-account.test.js`): dates and overdue in the shop's days, open first; the Owner only; in the way, and the customer page's request; what goes and what stays; a sale, a booking and a merge racing the deletion. Watch each fail
- [x] 2.2 The list and the deletion (`server/privacy-requests.js`), the routes (`server/routes/privacy-requests.js`), the customer page's `deletionRequest`, deleted customers off the customer list
- [x] 2.3 Break each rule on purpose, see its test go red, and restore
- [x] 2.4 Review: a chain of merges followed all the way; the customer held before the chain is read; the till's alerts lose the name; locks in the app's order (merge records, customer, chain, sign-ins, jobs, request); files removed after the save. Tests first, watched failing ("deadlock detected"), each order broken on purpose
- [x] 2.5 Re-review: the deletion steps back (a 0.8-second lock wait, a pause, one retry, logged) so a mechanic's Mark ready is never the one cancelled; the merge clean-up takes its merge record first. Test first (a third connection fixes the order), watched failing with the mechanic's "deadlock detected", the old wait put back on purpose

## 3. The screens (`jack/delete-account-screens`, stacked on 2)

- [x] 3.1 Screen tests first (`tests/customer/delete-account.test.js`, `tests/screens/privacy-requests.test.js`): the Your data card, the pop-up and its three states, the bar and Cancel my request; the Customers link for the Owner, the Privacy requests page, Delete their details, the customer page line. Watch each fail
- [x] 3.2 The account screens (`src/screens/book/account.tsx`, `/me`'s `shopPhone`); the shop's screens (`src/screens/customers/privacy-requests.tsx`, the Customers link, the customer page line, the `cs-privacy` address)
- [x] 3.3 Browser test (`tests/browser/delete-account.spec.ts`): Maya asks, the Owner deletes her details from Customers, her account is gone, at a computer's and a phone's width
- [x] 3.4 Break each rule on purpose; log choices in Jack's lane of `decided-while-building.md`; lint, `npm test`, `npm run test:browser`, the consolidate check
- [x] 3.5 `/opsx:archive` as the last commit
