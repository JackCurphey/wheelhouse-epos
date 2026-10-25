# Design: the staff sign-in screens

## Decisions

### 1. One signed-out page, five cases
`SignedOut` in `src/staff/staff-layout.tsx` moves to its own file,
`src/staff/signed-out.tsx`. It draws the `centred` frame from `signin.mjs:29`:
- the word Wheelhouse, with no logo (none exists);
- a card on the sand ground on a computer, filling the screen on a phone.

It picks what to show, in this order:
1. **`?signin=<reason>`:** the failed sign-in's message (decision 4).
2. **`/workshop/signed-out`:** `auth-signedout`, word for word.
3. **The session has run out (`expired`):** `auth-expired`, with its lock
   in the warning round icon, word for word.
4. **Otherwise:** straight to WorkOS, through `pageNav.go`, with this page as
   `from`.

"Sign in again" on 2 and 3, and each message's button, go to
`/api/auth/workos/start`. For 3 it adds `?from=` with the page the person was
on, and for 1 and 2 it doesn't (no page to go back to).

### 2. Telling "run out" from "never signed in"
`GET /api/auth/me`'s 401 gains `reason: 'expired'` when the browser sent a
`wh_session` cookie that isn't a live session. That covers a session past its
30 days, or one ended elsewhere.

Signing out clears the cookie (`clearSessionCookie`), so after signing out,
or on a first visit, there's no cookie and no `expired`.

`useSession`'s signed-out state carries `expired` from the 401's body. Only
`/me` sets it, and other routes' 401s are unchanged.

### 3. Back where you were: `from`
- `GET /api/auth/workos/start?from=/workshop/diary` keeps `from` in a second
  10-minute cookie (`wh_signin_from`). It sits beside the state cookie, with
  the same path and attributes.
- The callback goes there on success, otherwise `/workshop`.
- `from` is kept only if it is a staff-app address: `/workshop` or
  `/workshop/…`, with no `//` and no `\`. Anything else is dropped, so a
  sign-in link can't send someone off-site.
- The cookie is cleared on success and on failure.

### 4. A failed sign-in's words (not drawn; logged for Jack)
The frame is the same, with the heading and line below and one button. The
wording follows the customer sign-in's messages (`decided-while-building.md`,
customer-code-signin 3–5).
- `not-on-staff`: "That email isn't on a staff list". "Sign in with the
  email your shop has for you, or ask the shop's owner to add you." Button:
  "Sign in again".
- `unchecked`: "Check your email first". "WorkOS sent you an email to check
  it's yours. Open it, then sign in again." Button: "Sign in again".
- `busy`: "Too many tries". "Wait a few minutes, then try again." Button:
  "Try again".
- `failed`: "That sign-in didn't work". "Please try again." Button: "Try
  again".
- `off`: "Signing in isn't switched on yet". "Ask whoever runs Wheelhouse
  for your shop." No button, because pressing one would only come back here.
- Any other reason reads as `failed`.

### 5. WorkOS's sign-out comes back to `/workshop/signed-out`
- `return_to` becomes `<app>/workshop/signed-out`, and the pretend
  version's sign-out address does too.
- With no `signOutUrl`, Sign out goes there directly.
- `/workshop/signed-out` is a staff-app address the server already serves:
  `/workshop/*` is the staff app.
- **For Jack:** add `http://localhost:8080/workshop/signed-out` as a
  Sign-out URI in WorkOS's Redirects. WorkOS's docs don't say whether
  `return_to` has to match one, so the final check confirms it.

### 6. Straight to WorkOS
A first visit costs no click (Jack, fewest clicks). There's no loop:
- a failed sign-in comes back with `?signin=`, which shows a message and
  doesn't send the person on;
- a session that has run out shows `auth-expired`.

## Risks

- **Sign-in is a risky area**, so it needs `/review`.
- **The `from` cookie** could become a redirect off-site. Decision 3's
  check is the guard, with tests for `//evil.example`, `https://…`, `/\…`
  and `/book`.
