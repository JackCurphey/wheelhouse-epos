# Tasks

One pull request, on top of #504.

## 1. Tests first

- [x] 1.1 Server tests (`tests/staff-signin-workos.test.js`):
  - `/me` says `expired` for a cookie with no live session, and not for no
    cookie;
  - `from=/workshop/diary` comes back there after signing in;
  - `//evil.example`, `https://evil.example`, `/\evil.example`, `/book/x`
    and a missing `from` all land on `/workshop`;
  - a failed sign-in clears `wh_signin_from`;
  - the pretend sign-out address is `/workshop/signed-out`.

  Watch each one fail.
- [x] 1.2 Provider test: WorkOS's `return_to` is `<app>/workshop/signed-out`.
  Watch it fail.
- [x] 1.3 Screen tests (`tests/screens/staff-shell.test.js`):
  - `/workshop/signed-out` shows the drawn words, and "Sign in again" goes to
    start;
  - an `expired` 401 on the diary shows the drawn words, and "Sign in again"
    goes to start with `from=/workshop/diary`;
  - each `?signin=` reason shows its words and button, and `off` has none;
  - a plain signed-out diary goes straight to start with
    `from=/workshop/diary`, with nothing else shown;
  - Sign out with no `signOutUrl` goes to `/workshop/signed-out`.

  Watch each one fail.

## 2. Build

- [x] 2.1 Server: `reason: 'expired'` on `/me`, `from` on start and the
  callback, and the sign-out addresses (design 2, 3, 5). Checked by 1.1 and 1.2.
- [x] 2.2 `src/staff/signed-out.tsx` and `useSession`'s `expired` (design 1,
  2, 4, 6). Checked by 1.3.
- [x] 2.3 Log design 4's wording, design 6, and the new Sign-out URI in
  `decided-while-building.md` (Jack's section).

## 3. Check

- [x] 3.1 `/review` (sign-in). Then lint, the type check, `npm test` and
  `npm run test:browser`.
- [x] 3.2 Look at each page in the browser at computer and phone widths
  against `auth-signedout` and `auth-expired`, and check that sign-in and
  sign-out against WorkOS's real test page come back as designed. Jack adds
  the Sign-out URI first.

  Done 25 Oct.
  - **Against the drawings:** looked at at 1280 and 375 px wide (the name
    over a card on the sand ground, the card falling away on a phone). The
    button was changed to the drawn accent one.
  - **Against WorkOS's real test page,** after Jack added the Sign-out URI,
    Jack did four things, and each worked:
    1. opened the diary signed out and went straight to WorkOS;
    2. signed in and was back on the diary;
    3. signed out through WorkOS and landed on "You've signed out";
    4. pressed "Sign in again", and WorkOS asked him to sign in properly.
  - **What the server side showed:** one live session in Wheelhouse and at
    WorkOS, the same one, from step 4. The server log was clean.

## Workflow follow-up

- `/opsx:archive` as the last commit, then merge when CI is green, after #504.
