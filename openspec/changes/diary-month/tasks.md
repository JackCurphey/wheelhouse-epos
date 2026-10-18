# Tasks: month view in the diary

## 1. Tests first, each watched failing

- [x] 1.1 Rules: a month as whole weeks, its name, and the arrows' month step (failed: not exported)
- [x] 1.2 Screen tests: three jobs and "+[n] more"; the day's list and its Day view line; the date opens the Day view; a job opens its page; Next month; a tap on a day on a touch screen; the phone's Choose a day (all failed: no month view)
- [x] 1.3 Browser: the month fits at 1280 and 1024px with "+1 more"; on a tablet a tap on a day opens its list with 44px rows (all three failed with the tap and the three-job limit broken)

## 2. Build

- [x] 2.1 `monthOf`, `monthLabel` and `addMonths` in `rules.ts`
- [x] 2.2 The month grid, the day's list, the toolbar's Month tab and month arrows
- [x] 2.3 The phone's week label opens Choose a day

## 2b. After the fresh review

- [x] 2b.1 Tests first, watched failing: on a touch screen a real button over each day's jobs opens its list, and the date's tap area is 44px; the month is a region, not a grid; switching to Month stops choosing a time for New job
- [x] 2b.2 The fixes; the tablet note and the phone sheet's subtitle, as drawn; "Shared queue" for a job with no mechanic, logged
- [x] 2b.3 The Week/Day test measures from Month, now the switch's last tab
- [x] 2b.4 Jack, 18 Oct: below 1366px the toolbar takes two rows; test first at 1280px (one row on main), the one-row test moved to 1366 and 1440px; the Shared queue requirement modified
- [x] 2b.5 Second review: the touch day button's name keeps its visible words (test watched failing with an aria-label)

## 3. Checks

- [x] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
