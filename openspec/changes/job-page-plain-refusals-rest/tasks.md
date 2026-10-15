# Tasks: plain words for the job page's and diary's other refusals

## 1. Tests first, each watched failing

- [x] 1.1 The plain-words table: each server message in scope reads as its sentence; a message already in plain English passes through unchanged
- [x] 1.2 Work and parts: a paid order's refusal reads "This job has been paid for, so its work and parts can't change."
- [x] 1.3 Removing a day that has gone reads "That day has already been removed."
- [x] 1.4 Dropping finished work on the diary reads "Couldn't move Trek Domane AL 3: The work is already finished. Reopen the job to change it."

## 2. Build

- [x] 2.1 The sentences in `refusal-words.ts`; work and parts, add/remove a day and the diary drag use them

## 3. Checks

- [x] 3.1 Sentences logged in Jack's section of `decided-while-building.md`
- [x] 3.2 A fresh review (it found a product, a mechanic and a deleted order still in the server's words, and a test using a status no order has; each fixed, tests watched failing); `npm test` and `npm run test:browser` pass
