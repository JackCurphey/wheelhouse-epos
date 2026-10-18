# Design: the till asks who is signing it off

## Contract

`POST /api/sale-documents/:id/convert` gains an optional `signedOffBy`.
- When the order's job is in progress and paying finishes it (the existing `applyEvent(... 'finish')`), and `signedOffBy` is an active mechanic of the shop, the sign-off is recorded (`recordSignOff`: the job's `signed_off_by`, `signed_off_name`, `signed_off_at`, and a `workshop_job_sign_offs` row).
- `signedOffBy` given but not an active mechanic: the job still finishes, unsigned, and the reply carries `jobWarning: "Paid and finished, but not signed off: [reason]. Check the job."`.
- No `signedOffBy`: finishes unsigned, as today (the old app).
- Work already finished: `signedOffBy` is ignored; its sign-off stands.
- Never a refusal over the sign-off: the card is taken before this call (the 18 Oct till review).

## Screens

- `JobTill`: when `job.workState === 'in_progress'`, Take payment opens `SignOffDialog` (piece 1's, unchanged wording). "Sign off and mark ready" closes it and opens `PayDialog` with `signedOffBy`; Cancel opens nothing.
- `PayDialog`'s job payment sends `signedOffBy` with convert when it has one.
- A `jobWarning` already makes Paid wait with the note and skips handing the bike over (#267).
