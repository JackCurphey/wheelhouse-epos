# Tasks

## 1. Tests first

- [x] 1.1 `tests/customer-code-signin.test.js`:
  - a guest customer with the email (different case and spaces) is joined;
  - two matches make a new customer;
  - a match that already has a login makes a new customer;
  - an inactive or merged match isn't joined;
  - change the old "never joins" test to the two-match case.

  Watch each one fail.
- [x] 1.2 `tests/portal-account.test.js`:
  - `job-<id>` opens the owner's repair page data, including past the
    link's expiry;
  - another customer's job, another shop's session, no session, and a
    nonsense id all give 404 like a bad code;
  - the quote and notes routes work with `job-<id>`;
  - a cancel by `job-<id>` sends a message linking to the account;
  - `/history` gives repairs with stage and total, and old and till
    purchases with what was bought, newest first, and 401 signed out.

  Watch each one fail.

## 2. Build

- [x] 2.1 The join (design 1), the `job-` code (design 2) and `/history`
  (design 3). Update `tests/fixtures/route-list.txt`. Log the choices in
  `decided-while-building.md`.

## 3. Check

- [ ] 3.1 `/review` (customer accounts and public routes); lint, `npm test`
  and `npm run test:browser` locally; the pull request; archive as the last
  commit.
