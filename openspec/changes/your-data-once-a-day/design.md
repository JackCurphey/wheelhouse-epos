# Design: One copy of your data a day

## 1. The check (`POST /api/portal/:shopSlug/me/data-copy`)

Inside the route's existing transaction, after the sign-in's customer is
read again and locked:

- The customer row is locked `FOR SHARE` first, then the sign-in's own row
  (`customer_logins`) `FOR NO KEY UPDATE`: `FOR SHARE OF c FOR NO KEY UPDATE
  OF l`. Two requests from the sign-in at once take turns; a sale or a
  message for the customer is never held up (the review of #587); and the
  customer comes first, as a merge and its Undo lock them, so a copy and a
  merge never deadlock (the review of #589).
- If `privacy_requests` has a row for this sign-in, kind `copy`, from the
  account, asked since the start of the shop's day
  (`date_trunc('day', now() AT TIME ZONE zone) AT TIME ZONE zone`, in SQL),
  the request is rolled back and answered 429: "You’ve already downloaded a
  copy today. You can get another tomorrow." Nothing is logged.
- The in-memory `dataCopyLimiter` is removed.

The day is the shop's (`workshop_settings.time_zone`, as the copy's dates
use), and compared against the log's own `asked_at`, the database's clock.

## 2. The screen (`src/screens/book/account.tsx`)

- A 429 with the server's words shows them in the drawn warning bar, with no
  Try again (it would only be refused until tomorrow).
- A 429 with no words of its own (a proxy's page) is a download that didn't
  start, as before.
- "Not started? Download it again" is unchanged: it saves the file the
  browser already holds, with no new request, so a failed save never uses up
  the day.
