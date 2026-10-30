# Design: Download a copy of your data

## 1. Migration 108: `privacy_requests`

One row per privacy request: who (`customer_id`, `ON DELETE SET NULL` so the
paper trail outlives the record), what (`kind`: `copy` or `delete`), where
from (`source`: `account` or `shop`), the sign-in that asked from the
account (`customer_login_id`), `asked_at`, and `done_at` (null while open). Row-level security per shop, as every shop table. `CREATE TABLE IF
NOT EXISTS` and policies dropped before they are made, so it is safe to run
twice. `delete` and `shop` are in the checks now because the Privacy
requests list (`cs-privacy`) draws both kinds and both sources; nothing
writes them yet.

`privacy_requests` joins the merge's moved tables (`MOVED` in
`server/routes/customer-merge.js`), so a merge and its Undo carry the log
with the customer. A copy asked for after the merge by the merged-away
person's sign-in is logged on the kept record; Undo sends it back with that
sign-in (review of #587).

## 2. The route

`POST /api/portal/:shopSlug/me/data-copy`, for the signed-in customer only
(401 otherwise, or for another shop's sign-in). A request from another
website is refused (403), as the account's other actions are. Each sign-in
may take 10 copies in 15 minutes; the 11th is refused (429, "That’s a lot of
copies at once. Try again in a few minutes."), before anything is read or
logged. In one
transaction it reads the sign-in's customer again, `FOR SHARE` (so a merge
waits, and a merge that has just finished points it at the kept record; a
record merged away gets 401), records the request (`kind 'copy'`, `source 'account'`,
`asked_at` and `done_at` both the database's `now()`), reads the data, and
commits; only then does it reply. `Cache-Control: no-store`. (With
`DB_TENANT_SCOPE=transaction`, off by default, that commit only ends a
savepoint, as for every route.)

The reply is `application/zip`, with `Content-Disposition: attachment;
filename="<shop slug>-your-data-<YYYY-MM-DD>.zip"`, the date the shop's day
(its time zone, as the history uses).

## 3. What's in it

Six CSV files, each starting with the UTF-8 mark (so Excel shows £ and ’),
with a header row, cells quoted as the stock take's download quotes them,
and a cell starting `=`, `+`, `-`, `@` or a tab prefixed with `'` so a
spreadsheet never runs it; a negative number such as a refund's total stays a
number:

- `your-details.csv`: name, email, mobile, address, postcode; for a company,
  contact name, VAT number and invoice email; the email you sign in with.
- `your-bikes.csv`: make, model, colour, frame number and when it was added,
  for each of their bikes still on the account.
- `your-repairs.csv`: reference, date, bike, work, where it's up to (the
  account's words), total, and when you agreed to the booking terms.
- `your-purchases.csv`: receipt number (or "No. [id]"), date (the shop's
  day, worked out by the database), what was
  bought, total, from both sales records, as the history shows them.
- `your-messages.csv`: your conversation with the shop (who, when, about
  which repair, the words), then messages the shop sent you (when, how, the
  subject and words) that went.
- `what-you-agreed-to.csv`: job updates by; service reminders, review
  requests, offers and news (yes or no); when and where a yes to reminders
  was given.

Left out: the shop's own private notes about the customer and their bikes
(staff-only, not shown on the account); messages that never went (undone,
failed or waiting).

## 4. The zip

A small writer in `server/lib/zip.js`: files stored (not compressed; CSVs
are small), UTF-8 names, CRC-32 from Node's `zlib.crc32`. No new dependency.

## 5. The screen (`src/screens/book/account.tsx`)

- **Your data card**: heading "Your data", and "Download a copy of your
  data" as a link-style button (the drawn `actBtn`), under History on a
  computer and last on a phone.
- **Pressing it** posts to the route. On success the zip is saved through a
  link to the file the browser holds, and a green bar (role status) says
  "Your data is downloading as one file, [file name] — details, bikes, jobs,
  purchases, messages and what you agreed to." with "Not started? Download
  it again", which saves that same file again; leaving the account lets the
  browser go of it. On failure a warning bar says "The download didn't start." with
  Try again. A 401 sends them to sign in, as the account's loading does.
- The bars sit at the top of the account, under its title (the drawing puts
  them above the title, which the booking pages' frame draws itself).
