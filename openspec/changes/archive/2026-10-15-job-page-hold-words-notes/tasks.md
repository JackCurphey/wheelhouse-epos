# Tasks: the job page's Hold button, plain refusals, read-only notes on finished work, and its words for ended bookings

## 1. Tests first, each watched failing

- [x] 1.1 Put on hold shows on Expected, Booked in, In the workshop and Waiting for parts, and sends `hold` with the version; not on Finished, On hold or a booking request
- [x] 1.2 A refused move reads in plain words from the job's state; a stale one still says the job changed; a refused quote reads in plain words
- [x] 1.3 On finished work the notes box is read-only, says "Reopen the job to change its notes." and has no Save notes
- [x] 1.4 The status reads Change requested, Cancelled, Declined or Expired for those bookings (on the status function, and on the page for a change request and, through its menu, a cancelled job)

## 2. Build

- [x] 2.1 The four changes, screens only

## 2b. After the fresh review

- [x] 2b.1 Tests first, watched failing: a cancelled job's page can't be booked in; unsaved notes don't stay once the work is finished; an answer the customer beat staff to reads in plain words. A change request's amber badge is guarded
- [x] 2b.2 The fixes; Change requested needs the requested time, as in the diary

## 3. Checks

- [x] 3.1 `npm test` (1782/1782) and `npm run test:browser` (34/34) pass. A fresh review against Jack's answers found unsaved notes kept, the answer refusals, a cancelled job bookable in and the change-requested rule; each fixed
