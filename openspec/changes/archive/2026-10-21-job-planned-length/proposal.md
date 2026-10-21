# Proposal: a job's planned length reaches the screens

## Why
When a customer books online, their job's planned length is the total of the
services they chose (`planned_minutes`). The server uses it when staff offer
another time (`POST /api/workshop-jobs/:id/offer`), but never sends it in a
job reply. The diary's offer reads `plannedMinutes` first
(`src/screens/diary/offer-dialog.tsx`, `requestMinutes`), finds nothing, and
falls back to the job's times or an hour. So a request with no set time (a
whole-day booking) is shown and placed as 60 minutes in the diary, while the
server books it for its real length. Found by the fresh review of the
reply-shape file (pull request 363).

## What changes
- Every job reply carries `plannedMinutes`: the job's planned length in
  minutes as stored (what staff gave, the length of its times, or an online
  booking's services' total), or null when a job has no times and none was
  given.
- The reply-shape file and the screens' fake job gain the field.

No drawing changes: the offer bar, the request pop-up and the offer pop-up
already show "[n] minutes" from this field. No decision is touched.

## Risky areas
None of the four (no migration, no money or stock, no sign-in or public
route, not `server.js` or the messaging core).
