# Tasks

- [x] 1.1 Tests first: the sums (`tests/screens/cash-count-rules.test.js`: the twelve notes and coins in pence; the drawing's count is £208.70; 10p + 20p is exactly 30 pence; a typed total read in whole pence, "0.29" is 29; wrong totals; pounds shown as "£0.05") and the counter (`tests/screens/note-coin-counter.test.js`: twelve boxes as drawn; the boxes add up with each box's worth; nothing counted yet; a typed total takes over; a box changed after goes back to adding up; clearing the total; digits only; a wrong total). Watch each fail
- [x] 1.2 The sums (`src/lib/cash-count.ts`) and the counter (`src/screens/till/note-coin-counter.tsx`)
- [x] 1.3 Break each key rule on purpose, see its test go red, and restore
- [x] 1.4 Log choices in Jack's section of `decided-while-building.md`; lint, typecheck and the touched tests
- [x] 1.5 Self-review and `/review` (money); a pull request, with `/opsx:archive` as its last commit
