# What only the old diary did, drawn for the new diary (18 Oct 2026)

Jack retired the old app's workshop diary on 18 Oct, on the condition that
nothing it did is lost for good (`2026-10-18-retire-old-diary.md` item 2).
Each piece it alone had is drawn for the new diary first, for Jack to
approve. Jack, 18 Oct, one question per drawing. The old diary's way
(`public/app.js` before 78960ef) is followed where the new diary has no
pattern of its own.

The drawings are `oldDiaryFeatureDrawings()` in
`docs/design/user-journeys/generator/diary.mjs`, desktop only (as decision
25 did while a design was agreed). They are not on the canvas yet. Example
jobs come from the drawn week (14–20 Sep); every other day of the month is
left empty rather than filled with made-up jobs.

1. **Month view: "+[n] more" opens the day's list beside it** (Jack: "1",
   as drawn). The CAL-02 feature (`2026-08-31-feature-catalogue.md`).
   "Month" joins Week and Day; the dates read "September 2026". Each day
   shows up to three jobs, earliest first, as the start time and the bike
   (decision 29: bike first), coloured by status as in the week view. A
   busy day ends with "+[n] more", which opens a list over the month from
   that day: time, bike and job title, status, customer and mechanic, with a link to open
   that day in the Day view. Clicking a row opens the job; clicking a day's
   date opens that day in the Day view. The Waiting for you column stays.
   Chosen over "+[n] more" going straight to the Day view, and over no
   "+[n] more" at all.
2. **Stretching: drag the bottom edge only** (Jack: "1"). The CAL-05 feature,
   same file. A grip sits on the block's bottom edge; while dragging, a
   label beside the pointer gives the new times and length ("11:30–13:30 ·
   2 hours"). It moves in 15-minute steps, can't pass closing time and
   can't go under 15 minutes, as the old diary. Chosen over both edges (the
   old diary), whose top grip sits where you grab a block to move it.
3. **"Change details" on the job page, with the mechanic** (Jack: "1",
   include it). A "Change details" button in the job page's title bar opens
   a pop-up: job title, customer, bike, date, start time, end time, and the
   mechanic as pills (Alex Morgan, Jo Taylor, Shared queue; in the booking
   pop-up's style, decision 62)
   with the job's mechanic picked. Cancel and "Save changes". **This changes
   Workshop day decision 32** (`2026-09-27-workshop-day-review.md`): the job
   page itself still has no mechanic field and shows the mechanic as plain
   text, and dragging in the Day view still works, but the pop-up is a
   second way that needs no dragging (keyboard users, touch screens).
   Chosen over keeping the mechanic drag-only.
4. **The right-click menu gains three actions, greyed with a reason when
   they can't be used** (Jack: "1", as drawn). Under "Open job" and "View
   overview": "Open in the till" (the job's order in the till) and "Print
   receipt" (the till receipt, once the job is paid). Greyed lines say why:
   "Not paid yet", "Not booked yet", as the old diary's "No order linked to
   this job". On a booking request the old "Approve" is "Accept or
   decline", which opens the request's usual pop-up (Accept, Another time,
   Decline). Chosen over hiding what can't be used. The old menu also
   approved a pending job staff had made; staff can't make one in the new
   diary, so that case has nothing to do (`decided-while-building.md`,
   18 Oct).
5. **A "Shared queue" button beside the mechanics** (Jack: "1", as drawn),
   for the old "Unassigned" pill: Everyone, each mechanic, then Shared
   queue. Picked, the diary shows only the jobs no mechanic has yet. "Shared
   queue" is the new app's word for them already. Chosen over leaving it to
   the Overview page's Shared queue tab.

**Still to do:** the tablet and phone versions of month view, Change details
and the menu, drawn before each piece is built; an OpenSpec change for each piece (each touches the
`workshop-diary` spec). How the menu prints a paid job's till receipt
is settled when it is built (the old diary built the receipt in the browser
from the sale and printed the page). Deleting a job and
attachments still wait for #225.

**Tablet and phone, 18 Oct** (Jack approved all four drawings): stretching
and the Shared queue, `stretchTabletBoard`, `stretchPhoneBoard`,
`sharedQueueTabletBoard` and `sharedQueuePhoneBoard` in `diary.mjs`, not on
the canvas yet.

- **Stretching on a touch screen: the grip shows only on the chosen job**
  (Jack: "1"). A finger-sized grip (a 44px touch area) shows on that job's
  bottom edge, and the times and length show while dragging, beside the job
  on a tablet and inside it on a phone. Dragging to scroll can't stretch a
  job by accident. Chosen over a grip on every job, and over no stretching
  on touch screens (Change details only).
- **Corrected, 18 Oct: how a job is chosen for it.** The note above first
  said "one tap chooses the job, as today", but on the diary a tap opens a
  job; only Waiting cards are chosen by a tap. Asked again, Jack chose
  **holding the job, then "Change length" in its menu** (Jack: "1"), which
  shows the grip on that job; a tap still opens a job in one tap. Chosen
  over first tap chooses and second opens (two taps to open any job), and
  over no dragging on touch screens.
- **Shared queue on a tablet** is a fourth button after the mechanics, as on
  desktop; **on a phone** it is the last line of the "whose jobs" list,
  after Everyone, By mechanic and each mechanic.
