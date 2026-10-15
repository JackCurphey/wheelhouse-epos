# Proposal: the job page's Hold button, plain refusals, read-only notes on finished work, and its words for ended bookings

## Why

Four of the job page's known problems in issue #190, which Jack answered on
15 Oct (`docs/decisions/2026-10-15-job-page-fixes.md`), screens only:

- B. Nothing puts a job on hold, though "On hold" has a Resume button.
- C. Refusals show internal words ("cannot book_in a job that is in_shop"),
  and every refused stage button says "This job changed while you were
  looking at it", even when nobody else changed it.
- E. On finished work the notes box can be typed in, then Save notes is
  refused.
- F. A cancelled, declined, expired or change-requested booking reads
  "Expected" or "In the workshop".

## What Changes

- **Put on hold** (Jack: "1"): a secondary button beside the main one in the
  bottom bar when the job is Expected, Booked in, In the workshop or Waiting
  for parts. The server's `hold` move already exists.
- **Plain refusals** (Jack: "1"): a refused move is explained from the state
  the job is in ("The bike is already here."); "This job changed while you
  were looking at it." stays only for a stale refusal. Quote refusals too
  ("This quote has been sent. Withdraw it before changing it.").
- **Notes on finished work** (Jack: "1"): read-only, with "Reopen the job to
  change its notes." and no Save notes.
- **Status words** (Jack: "1"): "Change requested" (the diary's amber),
  "Cancelled", "Declined" and "Expired" (its grey). This also answers stage
  1 gaps decision 25 (a Change requested badge on the job window).

## Lane, drawings and decisions

- **Lane:** Jack's: `src/screens/diary/**`. No server change.
- **Drawings:** none show these; each is Jack's answer of 15 Oct. The
  sentences are logged in `decided-while-building.md` for Jack to overrule.

## Impact

- `src/screens/diary/job-dialog.tsx`, `src/screens/diary/quote-panel.tsx`, a
  new `src/screens/diary/refusal-words.ts`, the job page screen tests, and
  `workshop-jobs`' job page requirements.
