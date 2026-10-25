# Design: staff sign in with Google from Wheelhouse's own screen

## Decisions

### 1. The screen
`src/staff/signed-out.tsx` gains a fifth case, `staff-signin`, in the same
frame:
- "Sign in to Wheelhouse";
- "Continue with Google": an outlined button with a `[G]` placeholder where
  Google's official logo goes;
- an "or" line;
- "Sign in with email", the default button.

It shows at `/workshop/sign-in`, a new route under the screen id
`staff-signin`, and on any staff-app page opened signed out. That replaces
design 6 of `staff-signin-workos-screens`, the jump straight to WorkOS.
Signed in, `/workshop/sign-in` goes on to `/workshop`, as
`/workshop/signed-out` does.

Each button is a link to start, carrying `from`:
- **Google:** `/api/auth/workos/start?provider=google&from=<page>`.
- **Email:** `/api/auth/workos/start?from=<page>`.

`from` is the page that was opened. On `/workshop/sign-in` it's that page's
own `?from=`, or nothing.

### 2. Where "Sign in again" goes
- **"You've signed out":** to `/workshop/sign-in`.
- **"Please sign in again":** to `/workshop/sign-in?from=<the page>`.
- **A failed sign-in's button:** to `/workshop/sign-in`.

It's one more screen than before, but it's the screen where people choose
Google, so they never have to find Google on WorkOS's page.

### 3. Start takes `provider`
- **`provider=google`:** `authorizeUrl` gets `provider: 'GoogleOAuth'`
  instead of `authkit`, from WorkOS's docs (Google OAuth, checked 25 Oct).
- **Anything else, or none:** `authkit`, as now.
- **WorkOS's test environment:** it uses WorkOS's own Google settings, so no
  Google Cloud set-up is needed yet.
- **The pretend WorkOS:** it shows which way was asked for ("Pretend
  WorkOS · Google"), so tests can tell the two apart.

The callback is unchanged. A Google sign-in comes back the same way, with
the checked-email and staff-list rules.

### 4. Not drawn, decided here
The page's `<title>` and the heading are "Sign in to Wheelhouse". The `[G]`
placeholder is marked `aria-hidden`, so screen readers announce "Continue
with Google".
