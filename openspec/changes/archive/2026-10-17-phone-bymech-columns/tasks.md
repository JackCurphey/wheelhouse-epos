# Tasks: readable By mechanic columns on a phone

## 1. Tests first, each watched failing

- [x] 1.1 In a real browser at 360px with several mechanics: columns at least 96px (they were 47 with the fix undone), the diary area scrolls sideways and the page doesn't, the times stay put, the names follow

## 2. Build

- [x] 2.1 Columns with a 96px minimum; the grid in its own sideways scroll; the times stick at the left; the names kept in step

## 2b. After the fresh review

- [x] 2b.1 Test first, watched failing: a drag let go over the times, with a column scrolled under them, stays with its own mechanic (it moved the job to the hidden mechanic). The test seeds its own mechanic and job, so it reproduces when run alone
- [x] 2b.2 Drops count only the visible part of a column; the scroll keeps a 48px margin so a job reached by keyboard isn't hidden under the times (not covered by a test)

## 3. Checks

- [x] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
