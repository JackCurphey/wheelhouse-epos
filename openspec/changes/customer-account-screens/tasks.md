# Tasks

- [ ] 1.1 Tests first:
  - server: `/me`'s new fields, `/history`'s `bikeId` and `workStarted`;
  - screens (`tests/customer/account.test.js`): signed out goes to sign-in;
    the drawn parts with Maya's data, the empty states, the filters, Now and
    Earlier, Show more, a repair row's link, Sign out;
  - sign-in with no `from` goes to the account;
  - browser (`tests/browser/account.spec.ts`): sign in by code, the account,
    open a repair, at computer and phone widths.

  Watch each one fail.
- [ ] 1.2 Build design 1 to 3; log design 4.
- [ ] 1.3 `/review`, lint, `npm test`, `npm run test:browser`, pull request,
  archive as the last commit (after `customer-account-server` merges).
