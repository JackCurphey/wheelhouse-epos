# Proposal: Files and photos, and deleting a job, on the job page

## Why

The last two pieces only the retired old diary had
(`docs/decisions/2026-10-18-retire-old-diary.md` item 2). Jack answered how
they work on 18 Oct and approved the drawings
(`docs/decisions/2026-10-18-attachments-and-delete.md`). Their routes moved
into `server/routes/workshop.js` with #225.

## What Changes

- **Files and photos**, under Notes on the job page:
  - Photos show as small pictures that open larger. Other files show by name and size, and download.
  - The customer's booking photos are marked "From the customer".
  - "Add file or photo" uploads any file up to 15MB; a larger one is refused before sending.
  - "Remove" asks first ("Remove [file]?").
- **Delete job**, small at the left of the job page's bottom bar, which is now always shown:
  - It asks "Delete [job]?": "The job, its diary time and its files and photos are removed. This can't be undone.", with "Keep the job" and "Delete job".
  - While money has been paid on the job's order or the bike is in the shop, it says "Settle up first" and what is still open instead.
- **The server refuses those same deletes:** 409 with the code `settle_first`, saying which applies (`paid`, `inShop`). Today it deletes any job.

## Lane, drawings and decisions

- **Lane:** Jack's screens (`src/screens/diary/job-dialog.tsx`, a new
  `job-files.tsx`) and the workshop's delete route
  (`server/routes/workshop.js`; Mark said on 18 Oct his approval isn't
  needed for the waiting work).
- **Drawings:** `job-files`, `job-files-phone`, `job-delete-confirm`,
  `job-delete-blocked`, `job-delete-confirm-phone` (`diary.mjs`).
- **Decisions:** `docs/decisions/2026-10-18-attachments-and-delete.md`.

## Out of scope

- Deposits: none are taken yet. When they are, a deposit counts as money
  paid here.
- Removing location data from staff photos (decision CX-2 covers customer
  uploads); a follow-up if Jack wants it.

## Impact

- `src/screens/diary/job-dialog.tsx`, `src/screens/diary/job-files.tsx`,
  `src/lib/api/client.ts`, `src/lib/api/types.ts`, `server/routes/workshop.js`
- `tests/screens/job-files-delete.test.js`, `tests/workshop-jobs.test.js`
