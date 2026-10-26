# "Next service due" on the account's bikes

## Why

The account page's drawing (`ac-account`, audit L10) shows each bike's
"next service due [date]", only while the customer's service reminders are
on. It was left out until the account page existed
(`decided-while-building.md`, 26 Oct, account screens 1), and the account
page has now merged.

**Risky area:** customer accounts and public routes. The account's
`GET /api/portal/:shopSlug/bikes` gains a date, read-only.

## What changes

- **`GET /bikes`** gives each bike `nextServiceDue`. This is the day its
  service reminder is waiting to go, in the shop's time zone, or nothing
  when no reminder is waiting.
- **The account** shows "Next service due [date]" under the bike, joined to
  "In the shop now" when both apply, as drawn. It shows only while the
  customer's service reminders are on.
