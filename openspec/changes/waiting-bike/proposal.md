# Proposal: each "Waiting for you" item carries the bike

## Why

The `diary` drawing's tablet and phone Waiting cards have a bike line under
the customer's name ("Specialized Sirrus", `touchWaitingCard` in
`docs/design/user-journeys/generator/diary.mjs`). Jack's #241
(`openspec/changes/archive/2026-10-16-review-catch-ups/proposal.md`, item 2)
built the tablet cards but left the bike line for later: the waiting list
didn't carry the bike, and adding it is a server change. `.agents/STATUS.md`
puts it in Mark's half.

## What Changes

- **Server:** each item of `GET /api/workshop-waiting` (new online booking,
  change request, customer's cancellation) gains `bikeLabel`: the job's bike
  as the diary's own jobs name it (make then model, `WORKSHOP_JOB_SELECT` in
  `server/workshop/jobs.js`), or `null` when the job has no bike.
- No screen changes: drawing the bike line on the cards is Jack's, after this
  merges.

## Lane, work package, drawings and decisions

- **Work package:** a follow-up of the diary layout review (#238, #241),
  taken with stage 1's workshop.
- **Lane:** Mark's (server half). The waiting list is served from
  `server/routes/workshop.js`, in Jack's workshop area: per split plan §3,
  Mark's change there needs Jack's approval on the pull request.
- **Drawings:** `diary` (tablet, phone): the Waiting cards' bike line.
  Nothing changes in them.
- **Decisions:** `docs/decisions/2026-10-16-workshop-test-copy-changes.md`
  (the layout review's items, built in #240 and #241); decision 14 (how a
  card is chosen and opened) is untouched.

## Out of scope

- The cards drawing the bike (Jack's screens).
- The customer's typed bike note (`customerBikeNote`), which the job page
  already carries; the item carries only the linked bike, as diary blocks do.

## Impact

- Server: `server/routes/workshop.js` (the waiting list's query and item)
- Tests: `tests/workshop-waiting.test.js`
- Spec: `workshop-diary` ("Waiting for you" lists what customers are waiting
  on staff for)
