# Pills: one Tab stop per group, arrow keys within it

## Why
The staff app's pill groups (`role="radio"` buttons) are each their own Tab stop, and the arrow keys do nothing; the drawings' pills use a roving tabindex (diary.mjs `mechanicPill`), as a radio group should. Logged as a follow-up when the request pop-up's mechanic pills were built (#337); Jack wants the app as accessible as possible, and said to carry on with it (20 Oct).

## What changes
A shared `RadioPillGroup` (`src/components/ui/radio-pill-group.tsx`) replaces every staff `role="radiogroup"` of pill buttons: New job (Work, the services, Mechanic, Starting status), Change details' Mechanic, the request pop-up's Mechanic, Who's signing this off, and Settings' Notice in and booking mode. One Tab stop on the picked pill (or the first); arrow keys move and pick, wrapping; Home and End. Settings' booking mode only moves (its choice opens a question); Space or Enter picks.

## Impact
The component and the five screens; tests in `tests/screens/diary-answer.test.js`, `diary-new-job.test.js`, `job-sign-off.test.js`, `settings-page.test.js`. The customer's booking screens use native radios already.
