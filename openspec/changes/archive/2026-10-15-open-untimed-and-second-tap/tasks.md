# Tasks: a job with no time opens, and a second tap opens a Waiting card

## 1. A job with no time opens

- [x] 1.1 Screen tests first, watched failing: clicking a No time chip in the Week view opens that job's page; the same on a phone. Enter works because the chip is a button (a browser turns Enter on a button into a click; jsdom doesn't, so the screen tests click). While New job picks a time, a chip doesn't open, as a block doesn't (watched failing)
- [x] 1.2 Make the chips open the job, as a block does; they stay undraggable

## 1b. The Day view's No time row (Jack, 15 Oct)

- [x] 1b.1 Screen tests first: the Day view shows that day's untimed job and it opens (watched failing: no row); another day's untimed job is left out (watched failing with the date filter removed)
- [x] 1b.2 Pass the day's untimed jobs to the Day view's grid

## 2. A second tap opens a Waiting card

- [x] 2.1 Screen tests first, watched failing: a touch tap on the chosen card opens its pop-up; a mouse click on the chosen card does not
- [x] 2.2 Open the chosen card on a second touch tap. A click from the keyboard (Enter) is never a tap, as for a stack, so Enter on a chosen card only chooses it (watched failing after a tap)

## 3. Checks

- [x] 3.1 `npm test` (1754/1754) and `npm run test:browser` (34/34) pass. A fresh review against the drawings and decision 14 found four points: Enter after a tap, chips during New job's pick, the chip's drawn size, and the test notes; each fixed, the first two with tests watched failing
