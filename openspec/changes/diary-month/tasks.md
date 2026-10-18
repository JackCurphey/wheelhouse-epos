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

## 3. Checks

- [ ] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
