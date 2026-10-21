# Design

`src/screens/diary/diary-tiles.tsx`: `StackBlock` adds ", new, booked online"
to each new job in the stack's name and shows `NewOnlineMark` (short) on the
front card, on its own line from two lines' height, beside the bike below
that; the job line moves to the third line. `FanTile` shows the mark on a
third line. `src/screens/diary/diary-month.tsx`: the chip shows the website
icon after the bike and its name gains ", new, booked online"; the day list's
row shows the short mark. No server change: `newOnline` is on every job.
