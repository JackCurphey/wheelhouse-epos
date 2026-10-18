# A job's attachments and deleting a job (18 Oct 2026)

The last two pieces only the retired old diary had
(`2026-10-18-retire-old-diary.md` item 2). Their server half is #225
(moving the routes, no change in what they do). Nothing was drawn or
decided for the new job page, so Jack answered one question at a time
before anything is drawn.

1. **Deleting a job is allowed only when nothing is at stake** (Jack: "1").
   If money has been taken on the job's order (a deposit or a payment) or
   the bike is in the shop, a "Settle up first" pop-up says what to sort out
   first, following the approved pop-up for deleting a customer's details
   (`docs/design/user-journeys/generator/customer.mjs`, "Settle up first").
   Otherwise it asks "Delete [job]? This can't be undone." The server should
   refuse the same cases; today it deletes any job, so that check is added
   too. Chosen over any job after a confirmation, and over only managers and
   owners (staff permissions aren't built in the new app yet).
2. **"Delete job" sits small at the left of the job page's bottom bar,
   beside a shorter "Book in" (or whichever next step shows)**, as an
   outlined red button (the approved style for deleting, decision 53), so it
   is always in view without scrolling (Jack, 18 Oct, on seeing the
   drawings: "just so that the button is always visible on the page"). When
   a job has no next step, the bar shows "Delete job" alone. This replaces
   his first answer, the bottom of the details column under Notes, which he
   had chosen over the diary's right-click or hold menu, and over both.
3. **A "Files and photos" section under Notes** (Jack: "1"). Photos show as
   small pictures that open larger when tapped; other files (a PDF, say)
   show as their name and size. The customer's booking photos are labelled
   "From the customer". "Add file or photo" opens the camera or files on a
   tablet or phone, and the file picker on a computer. Each file has
   "Remove", which asks first. Chosen over the old app's plain list of file
   names, and over photos only.

**Drawn, 18 Oct** (Jack approved all: "1"): `job-files`, `job-files-phone`,
`job-delete-confirm`, `job-delete-blocked` and `job-delete-confirm-phone`
(`filesSection`, `jobPageWithFiles`, `deleteConfirm`, `deleteBlocked` in
`docs/design/user-journeys/generator/diary.mjs`), not on the canvas yet.
The confirmation reads "Delete [job]?" … "The job, its diary time and its
files and photos are removed. This can't be undone.", with "Keep the job"
and "Delete job". "Settle up first" lists what is still open ("Paid on its
order", "Bike in the shop") and "Refund what was paid and hand the bike
back — then delete.", with OK.
