# Tasks: month view in the diary

## 1. Tests first, each watched failing

- [x] 1.1 Rules: a month as whole weeks, its name, and the arrows' month step (failed: not exported)
- [x] 1.2 Screen tests: three jobs and "+[n] more"; the day's list and its Day view line; the date opens the Day view; a job opens its page; Next month; a tap on a day on a touch screen; the phone's Choose a day (all failed: no month view)
- [x] 1.3 Browser: the month fits at 1280 and 1024px with "+1 more"; on a tablet a tap on a day opens its list with 44px rows (all three failed with the tap and the three-job limit broken)

## 2. Build

- [x] 2.1 `monthOf`, `monthLabel` and `addMonths` in `rules.ts`
- [x] 2.2 The month grid, the day's list, the toolbar's Month tab and month arrows
- [x] 2.3 The phone's week label opens Choose a day

## 3. Checks

- [ ] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
