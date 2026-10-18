# Tasks: paying a workshop job's order at the till

## 1. Tests first, each watched failing

- [x] 1.1 Screen tests (till): locked lines, customer and job, the pill; paying converts the order and collects; pill off keeps the bike; no pill when the bike isn't in; already paid; work not started; a refusal in plain words (all failed: the till couldn't open a job)
- [x] 1.2 Screen tests (diary and job page): Open in the till opens the till; greyed Not booked yet and Already paid; Take payment on finished unpaid work, Hand over once paid (four failed; the last was already true)
- [x] 1.3 Browser: the job page's Take payment pays at the till against the real server, the order paid and the bike collected (watched failing with the collect step removed)

## 2. Build

- [x] 2.1 `JobTill` in `till-page.tsx`; `PayDialog` pays an order and runs what follows
- [x] 2.2 "Open in the till" in the job menu; "Take payment" on the job page

## 3. Checks

- [ ] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
