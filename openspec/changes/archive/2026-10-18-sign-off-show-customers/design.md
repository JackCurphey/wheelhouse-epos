# Design: showing customers who signed off

## Contract

- `GET /api/workshop-settings` carries `showSignOffToCustomers` (boolean, false for every shop until changed). `PUT` accepts it; leaving it out keeps the stored value.
- `GET /api/portal/:shopSlug/booking-links/:code` (and the replies of cancel, change and withdraw-change, which share the view) carries `checkedBy`: the job's `signed_off_name` when the setting is on, the stage is `ready_to_collect` or `collected`, and the job is signed off; otherwise `null`.

## Screens

- **Settings** (`/workshop/settings`): heading "Settings", then "Workshop" with its intro and a Mechanics section holding a switch row: "Show who signed off to customers", On/Off in words, and the note "Adds “Checked by [name]” to their receipt and booking link. Off: only staff see who signed a job off." Turning it saves at once (`PUT /api/workshop-settings`), and says so if it can't.
- **Receipt:** `ReceiptJob` gains `checkedBy`; a line under the job and bike.
  - Till: with the setting on, the name of whoever signed off — the job's `signedOffByName` when the work was already finished, or the mechanic picked in the till's pop-up when paying finished it — unless the reply warned that it wasn't signed off.
  - Diary: with the setting on, the job's `signedOffByName`.
- **Booking link:** "Checked by [name]" as a line in the summary box when `checkedBy` is set.
