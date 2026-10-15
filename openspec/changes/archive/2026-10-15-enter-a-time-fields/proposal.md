# Proposal: "Enter a time instead" gives the New job form Date and Start time boxes

## Why

"Enter a time instead" is New job's way in for anyone not using a mouse
(staff diary view design, 3 Oct). Today it opens the form at the grid's
first hour on the diary's date, and the form has no way to change the date
or time, so the job has to be moved afterwards. Jack chose on 15 Oct (issue
192) to add the boxes, and approved the drawing (`new-job-entered`).

## What Changes

- Opened by "Enter a time instead", the New job form shows Date and Start
  time boxes in place of the time it was clicked at, filled with the diary's
  day and its first hour. Saving uses what they hold.
- A click on the grid still opens the form at the clicked time, with no
  boxes, as now.
- Changing the date chooses the mechanic again for the new day (decision
  18), unless staff picked one themselves; the "chosen automatically" note
  goes once they do.
- A typed start time keeps to the quarter hour, as a click does, and a job
  that would run past midnight is refused in plain words, not the server's.
- Opened this way, the Date box has the focus: this route is for keyboard
  users.

## Lane, drawings and decisions

- **Lane:** Jack's: `src/screens/diary/**`. No server change: the form
  already sends the job's date and start time.
- **Drawings:** `new-job-entered` and the pick bar's "Enter a time instead"
  link (drawn 15 Oct).
- **Decisions followed:** Jack, 15 Oct, issue 192 (`2026-10-08-diary-fixes.md`).

## Impact

- `src/screens/diary/new-job-dialog.tsx`, `src/screens/diary/diary-page.tsx`,
  `tests/screens/diary-new-job.test.js`, and `workshop-diary`'s New job
  requirement.
