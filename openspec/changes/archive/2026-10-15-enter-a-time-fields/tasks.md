# Tasks: "Enter a time instead" gives the New job form Date and Start time boxes

## 1. The boxes

- [x] 1.1 Screen tests first, watched failing: Enter a time instead opens the form with Date and Start time filled with the diary's day and first hour; changing them saves the job at the new day and time; a click on the grid shows no boxes; an empty box is refused with a message
- [x] 1.2 Build the boxes, shown only when the form is opened that way. Seen in the real app: the form opens with today's date and 09:00

## 1b. After the fresh review

- [x] 1b.1 Tests first, watched failing: a new date chooses the mechanic again; a quarter-hour check; a past-midnight check in plain words. A mechanic picked by hand staying is guarded
- [x] 1b.2 Choose again on a new date unless picked by hand; check the time; focus the Date box

## 2. Checks

- [x] 2.1 `npm test` (1762/1762) and `npm run test:browser` (34/34) pass. A fresh review against the drawing found the mechanic kept on a new date, the decision not recorded, an untested note rule and unchecked times; each fixed, with tests watched failing
