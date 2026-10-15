# Proposal: plain words for the job page's and diary's other refusals

## Why

The rest of issue #190's problem C. #223 put the job page's refused moves
and quote actions into plain words (Jack, 15 Oct,
`docs/decisions/2026-10-15-job-page-fixes.md`, answer 2), but three places
still show the server's own wording:

- the job page's work and parts ("Each item needs a valid productId and
  positive qty", "This order is already converted");
- adding or removing a day on the job page ("That day of the job was not
  found", "Job not found");
- dragging a job on the diary ("This job is complete - reopen it before
  making changes.").

Jack, 15 Oct: do the rest of #190 in his lane, starting with this.

## What Changes

- The server's internal or technical messages for these three places read
  in plain words, in `refusal-words.ts`, alongside #223's sentences.
- A deleted job reads "This job no longer exists.", as in the request
  pop-up.
- Messages that are already plain English (the diary's rule refusals such
  as "That mechanic is already booked over part of that window - please
  choose another time.", "A job's first day can't be removed") still show
  as the server sends them.
- The sentences are logged in Jack's section of `decided-while-building.md`
  for him to overrule. *Pattern:* #223's refusal words.

## Lane, drawings and decisions

- **Lane:** Jack's: `src/screens/diary/**` (split plan §3). No server change.
- **Drawings:** none show these refusals.
- **Decisions:** `docs/decisions/2026-10-15-job-page-fixes.md` answer 2;
  issue #190 C.

## Out of scope

- The old app (`public/app.js`), which is being replaced.
- Changing the server's own messages (Mark's files).
- New job's refusals, already plain since #220.
- The rest of #190 A (ended bookings) and #192.

## Impact

- `src/screens/diary/refusal-words.ts`, `work-parts.tsx`, `job-dialog.tsx`,
  `diary-page.tsx`; their screen tests; `workshop-jobs`' work and parts and
  days requirements; `workshop-diary`'s refused-move requirement.
