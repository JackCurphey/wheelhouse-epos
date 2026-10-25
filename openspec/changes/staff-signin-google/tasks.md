# Tasks

## 1. Tests first

- [x] 1.1 Server (`tests/staff-signin-workos.test.js`):
  - `provider=google` sends the pretend WorkOS's page "Google", and the real
    one's authorize address has `provider=GoogleOAuth`;
  - anything else gets `authkit`;
  - `from` still comes back.

  Watch each one fail.
- [x] 1.2 Screens (`tests/screens/staff-shell.test.js`):
  - signed out on the diary shows "Sign in to Wheelhouse", with Google
    linking to start with `provider=google` and `from=/workshop/diary`, and
    email linking to start with `from=/workshop/diary`, with no jump;
  - `/workshop/sign-in` shows it;
  - "Sign in again" on signed-out, expired and failed pages goes to
    `/workshop/sign-in`, keeping `from` on expired.

  Watch each one fail.
- [x] 1.3 Browser (`tests/browser/staff-signin.spec.ts`): the diary signed
  out, then "Continue with Google", the pretend page, and back on the diary.
  Also the screen at 1280 and 375 px. Watch it fail.

## 2. Build

- [x] 2.1 `provider` on start, and the pretend page's label (design 3).
- [x] 2.2 The `staff-signin` case, its route, and "Sign in again" targets
  (design 1, 2, 4).

## 3. Check

- [x] 3.1 `/review` (sign-in); lint, the type check, `npm test`, `npm run test:browser`.
- [ ] 3.2 Look at the screen against the drawing at both widths. Jack
  presses "Continue with Google" on his Mac against WorkOS's real test
  environment, and on the hosted copy after merging.

## Workflow follow-up

- `/opsx:archive` as the last commit, then merge when CI is green.
