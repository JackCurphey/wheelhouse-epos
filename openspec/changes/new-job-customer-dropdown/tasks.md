# Tasks: New job's customer search drops down over the form

## 1. Tests first, each watched failing

- [x] 1.1 The results sit in their own drop-down that floats over the form; Escape closes it; typing opens it again
- [x] 1.2 In a real browser, New job is the same height before and after "No customer matches “zz”." shows (was 650 then 675.5); Escape keeps what was typed and New job

## 2. Build

- [x] 2.1 The drop-down on New job's customer search

## 3. Checks

- [ ] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
