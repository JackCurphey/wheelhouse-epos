# Tasks: Files and photos, and deleting a job

## 1. Tests first, each watched failing

- [x] 1.1 Screen tests: files listed (photos as pictures, the customer's marked, others by name and size); upload as the server expects; over 15MB refused before sending; Remove asks first; Delete job asks first and closes the page; Keep the job deletes nothing; Settle up first for a paid order and a bike in the shop; Delete job with no next step; the server's settle_first shown (all failed: no section, no button)
- [x] 1.2 Server tests: a booked-in job and a paid order are refused with settle_first (both were deleted, 200)

## 2. Build

- [x] 2.1 `job-files.tsx`; Delete job, its confirmation and Settle up first in `job-dialog.tsx`; the `settle_first` code in the client
- [x] 2.2 The server's settle-first check on DELETE (after #225 moved the route)

## 3. Checks

- [ ] 3.1 A fresh review; `npm test` and `npm run test:browser` pass
