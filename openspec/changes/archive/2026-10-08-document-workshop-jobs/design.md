# Design: document what workshop jobs already do

## Context

See `proposal.md` for why. The behaviour lives in:

- `server/server.js`: the "Workshop jobs" section (create, read, list, edit,
  days, private link), the "Workshop job actions" section (the fifteen
  action routes, all made by one function, `jobActionRoute`), job delete and
  attachments, and the order-payment route (`POST
  /api/sale-documents/:id/convert`), which finishes a job's work.
- `server/workshop/state-machines.js` (the three job machines),
  `transitions.js` (`applyEvent`: the state check and the version check),
  `references.js` (WH numbers), `legacy-status.mjs` (the old five-value
  status).
- Migrations 004 (attachments), 016 (states, reference, version), 021 (the
  old status becomes worked out by the database), 037 (a job's days).
- The staff job page: `src/screens/diary/job-dialog.tsx` and its work and
  parts table.

This change writes no code. The design questions are about how to describe
the app honestly, not how to build it.

## Goals / Non-Goals

**Goals:**

- Every requirement in `specs/workshop-jobs/spec.md` traced to a test or a
  named place in the code (the Evidence table below).
- Refusal wording quoted exactly as the code returns it.
- Anything that could not be confirmed is left out of the spec and listed
  under "Not confirmed".

**Non-Goals:**

- Fixing, changing or judging behaviour. Surprises are listed for Jack
  under "Differences from decisions and the older specs"; nothing is changed.
- The areas the proposal leaves out (diary, quotes, services, online
  booking).

## Decisions

1. **Plain English in the spec, internal names only here.** The spec talks
   about "the booking", "where the bike is" and "the work"; the code's names
   (`booking_state`, `custody_state`, `work_state`) appear only in this file.
   Refusal messages are the exception: they are quoted exactly, even where
   they contain internal state names (for example "cannot collect a job that
   is expected"), because that is what the app actually says.
2. **Tests first, code second as evidence.** Where a test pins the
   behaviour, the test is cited. Where only the code shows it (many refusal
   messages are only asserted by status code, or not at all), the route or
   function is cited instead. A screen test that uses a pretend server is
   cited for what the page does, and paired with the server code when the
   spec quotes the server's words.
3. **The day-and-time rules are in this spec, not left to the diary.** They
   are refusals of creating or editing a job, so a job spec without them
   would be wrong. The settings that feed them (opening days and hours, a
   mechanic's working days) stay in `workshop-diary`.
4. **Capacity holds are left out.** Every job move also keeps or releases a
   capacity hold, and a lost race for a slot is refused with the code
   "capacity". That is the capacity area (`workshop-diary`), so it is not
   specified here.
5. **The diary's day blocks ("Day 1 of 2") are left out** although the
   multi-day spec described them: they are diary views. The job page's days
   list is in.
6. **Example data comes from the tests** (WH-1000, WH-1042, "Gear cable",
   Maya Patel, Trek Domane AL 3, Alex Morgan, Sam, Jo, Brake pads (pair),
   Standard service, Frame rebuild, report.pdf), as the brief allowed. No
   name, price or wording is invented.

## Evidence

Test files are under `tests/`. "Code" cites `server/server.js` unless
another file is named.

| Requirement | Evidence |
|---|---|
| Every job has its own shop's reference number | `workshop-references.test.js`: "references count per shop, starting at WH-1000"; "concurrent allocations in one shop never hand out the same number"; "a reference is never reused after a job is deleted". `workshop-schema.test.js`: "two shops can hold the same job reference; one shop cannot"; "job numbers are allocated per shop, so volume does not leak between them". Code: `server/workshop/references.js` `allocateReference` |
| Staff create a job with a title, a date and optional times | `workshop-jobs.test.js`: "a job can be created and read back". `workshop-rules.test.js`: "the server rejects an edit to a complete job" (creates with status "complete"). Reviewer's live probe (8 Oct, not a repo test): create with "waiting_parts" gave scheduled / in the shop / waiting for parts. `workshop-holds-follow.test.js`: "a planned length must be whole minutes between 1 and 720" (status only). Code: `POST /api/workshop-jobs` (title, date and status messages; staff default status "scheduled" read through `readLegacyStatus`), `resolveJobTimes` (one-hour default end, time messages), `resolvePlannedMinutes` (message) |
| A job links only to a real customer, that customer's bike and a working mechanic | Code only: `resolveJobCustomerId`, `resolveJobBikeId` (both bike messages; the silent drop when the bike is not given), `resolveJobMechanicId`; used by `POST` and `PUT /api/workshop-jobs` |
| A job's day and time must fit the shop's rules | `workshop-rules.test.js`: "the server rejects a second job overlapping the same mechanic"; "the server rejects a job outside the shop opening hours"; "the server rejects a job on a day the shop is closed"; "the server rejects a job on a mechanic's day off"; "a mechanic working that day is still bookable" (all by status code). `workshop-job-parts.test.js`: "another job can't be booked over a job's second day" (matches /already booked/). Code: `checkJobSlot` (all four messages; untimed jobs skip hours and overlap) |
| Every new job comes with an order unless staff say otherwise | `workshop-jobs.test.js`: "creating a job creates the order that makes it billable"; "a job can be created without an order at all". Code: `createWorkshopJob` (`skipAutoOrder`), `serializeWorkshopJob` (`orderId`, `orderStatus`, `orderTotal`) |
| Staff can read one job and list jobs by date | `workshop-jobs.test.js`: "a new job appears in the diary for its date range"; "deleting a job keeps its order, detached" (404 on read). `workshop-job-parts.test.js`: "the jobs list finds a job by any of its days". Code: `GET /api/workshop-jobs`, `GET /api/workshop-jobs/:id` ("Job not found"), `serializeWorkshopJob` |
| Staff can edit a job's details | Code: `PUT /api/workshop-jobs/:id` (planned length worked out from the times on a timed job; no test). `workshop-legacy-save-version.test.js`: "a save with the version last read goes ahead and bumps it"; "a save without a version still works, and still counts as a change". `workshop-work-actions.test.js`: "a cancelled job is not frozen against edits the way finished work is". Code: `PUT /api/workshop-jobs/:id` |
| Finished work is frozen against edits | `workshop-rules.test.js`: "the server rejects an edit to a complete job" (status only); "reopening a complete job is still allowed". Code: `PUT /api/workshop-jobs/:id` (the `work_state === 'complete'` guard: compares title, date, notes, times, customer, bike, mechanic only, and its message); the days, attachment and private-link routes have no such guard. Reopening sets work to not started: `readLegacyStatus('scheduled')` in `state-machines.js` |
| Staff can delete a job | `workshop-jobs.test.js`: "deleting a job keeps its order, detached"; "deleting a job that does not exist is a 404, not a crash". Code: `DELETE /api/workshop-jobs/:id` (removes attachment files; no version, no state check) |
| A job records three separate facts: the booking, the bike and the work | `workshop-states.test.js` (machine definitions); `workshop-state-invariants.test.js`: "the three job facts share no state name"; "finishing the work does not move the bike"; "collecting the bike does not finish the work". `workshop-custody-actions.test.js`: "finishing the work does not collect the bike"; "a bike can be collected before the work is finished". `workshop-schema.test.js`: "the database refuses a state no machine declares". Code: migration 016 |
| Staff move a booking with accept, decline, request reschedule, cancel and expire | `workshop-booking-actions.test.js`: "accepting a pending request schedules it and the old column follows"; "cancelling keeps the record and reads as complete to the old diary"; "declining and expiring are their own endpoints, and are terminal". `workshop-holds-follow.test.js`: "declining a reschedule request returns a live job to scheduled, and its hold survives". `workshop-states.test.js`: "a request the shop accepts becomes scheduled"; "a declined request is terminal - a shop that changes its mind starts a new one"; "a scheduled booking can still be cancelled by either side". Code: `bookingRequest` in `state-machines.js`; the five `jobActionRoute` lines |
| Plain accept and decline refuse a customer's change request | `workshop-change-requests.test.js`: "the old accept and decline refuse a customer's change request" (exact body). Code: `jobActionRoute` |
| A staff cancellation is recorded as the shop's | `workshop-change-requests.test.js`: "a staff cancellation is recorded as the shop's". Code: `jobActionRoute` (`cancelled_by = 'staff'`) |
| Staff move the bike with book in, collect and reopen | `workshop-custody-actions.test.js`: "a bike cannot be collected before it is booked in"; "reopen-custody brings a collected bike back without touching the work". Code: `custody` in `state-machines.js`; `applyEvent` reads only the one machine's column, so the booking is not checked. Reviewer's live probe: book-in on a cancelled booking returned 200 (no repo test) |
| Staff move the work with start, waiting for parts, parts arrived, hold, resume, finish and reopen | `workshop-work-actions.test.js`: "a job cannot resume unless it is on hold"; "waiting for parts shows as waiting_parts to the old diary" (also shows work starting while the bike is still expected); "holding and resuming round-trips through the machine". `workshop-transitions.test.js`: "an illegal event is refused and changes nothing". `workshop-states.test.js`: "work moves through the states a mechanic actually works in"; "a job can be put on hold from anywhere it is live, and resumed"; "finished work can be reopened, because final checks fail". Code: `work` in `state-machines.js`; `applyEvent` reads only the one machine's column. Reviewer's live probe: start on a cancelled booking returned 200 (no repo test) |
| A refused move says why and what can be done instead | `workshop-booking-actions.test.js`: "accepting a job that is already scheduled is a 409, not a 400". `workshop-transitions.test.js`: "an illegal event is refused and changes nothing". Code: `server/workshop/transitions.js` `applyEvent` (message; the allowed-move check runs before the conditional version update, so illegal wins over stale; no test of both at once) |
| Every move needs the version the screen last saw | `workshop-booking-actions.test.js`: "a stale version is refused with 409 and a reload message"; "a missing version is a 400 - the caller must say what it saw". `workshop-transitions.test.js`: "a legal event moves the state and bumps the version"; "a stale version loses the race". `workshop-job-parts.test.js`: "Add another day needs the version the caller saw". Code: `jobActionRoute`, `VERSION_REQUIRED`, `staleRefusal`, the three parts routes; `carryOverUnfinished` raises the version (no test asserts it) |
| The old app's save takes part in the version check | `workshop-legacy-save-version.test.js`: "a save with an older version is refused and changes nothing" (exact body); "an accept on the copy read before a diary save is refused"; "a version that is not a whole number is refused"; "a save without a version still works, and still counts as a change" |
| Another shop's jobs are invisible | `workshop-booking-actions.test.js`: "another shop's job is 404, not 403". `workshop-transitions.test.js`: "another shop cannot move this job". `workshop-attachments.test.js`: "another shop can neither list, download nor delete the attachment". `portal-booking-link.test.js`: "staff cannot make a link for another shop's job" |
| Paying for a job's order finishes the work only when finishing is allowed | `workshop-work-actions.test.js`: "tendering the linked order finishes the work through the machine"; "tendering an order for work that never started is refused, not forced"; "a job on hold or waiting for parts is refused too, and says how to proceed". Code: `POST /api/sale-documents/:id/convert` (the pre-check before the sale; the already-finished case follows from `work` allowing only "reopen" from complete; the race case sets `jobWarning` on the reply after the sale; neither has a test) |
| A job can be worked over several days | `workshop-job-parts.test.js`: "a job carries its parts; a one-day job has just part 1"; "another job can't be booked over a job's second day". Code: migration 037 (day 1 kept identical to the job by triggers) |
| Staff can add another day to a job | `workshop-job-parts.test.js`: "Add another day adds the next day the shop opens and the mechanic works, at the same time"; "Add another day needs the version the caller saw". Code: `POST /api/workshop-jobs/:id/parts` (60-day message), `nextWorkingDay` |
| Staff can move or remove a later day | `workshop-job-parts.test.js`: "a later day can be moved to another day, time and mechanic; a clash is refused"; "a later day can be removed; day 1 cannot" (status only for day 1). Code: `PUT` and `DELETE /api/workshop-jobs/:id/parts/:partId` (both day-1 messages) |
| Unfinished work carries over to the next working day | `workshop-job-parts.test.js`: "an unfinished job whose last day has passed carries over to the next working day, once"; "a job is not carried over if the bike never came in, or the work is finished". Code: `carryOverUnfinished` (booking condition; no overlap check; raises the version) |
| Staff can attach files to a job | `workshop-attachments.test.js`: "an uploaded file is listed and comes back byte for byte"; "an empty file is refused as empty"; "an upload with no file data at all is refused as missing"; "a file over the 15MB limit is refused" (status only; message from code). Code: `POST /api/workshop-jobs/:jobId/attachments`. Only `public/app.js` calls the attachment routes; nothing under `src/` does |
| Staff can list, download and delete a job's files | `workshop-attachments.test.js`: "an uploaded file is listed and comes back byte for byte"; "a download names the file, including one the header cannot spell"; "deleting an attachment removes the row and the file on disk". Code: attachment routes (newest first; "Attachment not found") |
| Staff can make a new private link for a job's customer | `portal-booking-link.test.js`: "staff make a new link; the old one stops working"; "a job with no customer gets no link" (status only); "making a link needs a staff sign-in"; "the database holds the hash, never the code" (shown for the booking's link). Code: `POST /api/workshop-jobs/:id/private-link` (message; stores only the hash). No screen in `src/` or `public/app.js` calls it |
| The old app still sees one of its five statuses | `workshop-legacy-status.test.js`: "every legacy value survives the round trip"; "a cancelled, declined or expired booking reads as complete"; "the expression only ever yields one of the five legacy values". `workshop-schema.test.js`: "the old status column is derived, not written". `workshop-booking-actions.test.js`: "accepting a pending request schedules it and the old column follows". `workshop-work-actions.test.js`: "waiting for parts shows as waiting_parts to the old diary". Code: migration 021 |
| The old app can still set a job's status on create and save | `workshop-rules.test.js`: "reopening a complete job is still allowed". Code: `readLegacyStatus` mapping in `state-machines.js`; `POST /api/workshop-jobs` (custody from the mapping, or expected); `PUT /api/workshop-jobs/:id` (no move check, custody left alone, message). Old form always sends its status dropdown: `public/app.js` (job form submit; "Reopen job" sends the pre-complete status, default "scheduled"). Reviewer's live probe: an old-form save reset in-progress work to not started; un-cancelling is a code reading, not tested |
| The job page opens from the diary and shows where the job is | `screens/job-page.test.js`: "a click on a diary block opens the job: title, status, customer, bike, mechanic and ready-by"; "Enter on a block opens the job too"; "the job shows its number, the customer's words, its notes, and its work and parts"; "the status reads as staff say it at each stage". Code: `src/screens/diary/job-dialog.tsx` `jobStage` ("Booking request", "Quoting", "On hold" are code only) and the customer strip ("No customer", "Mechanic: Shared queue", total hidden at £0.00, "Created [day]": code only) |
| The job page offers the next step as a button | `screens/job-page.test.js`: the seven stage tests ("an expected bike is booked in" … "a finished bike is handed over"); "a collected job has no stage button"; "if someone else changed the job first, it says so". Code: `job-dialog.tsx` `stageActions` (no button for pending, cancelled, declined, expired) |
| The job page has one notes box and a "Bike is here" switch | `screens/job-page-edit.test.js`: "the notes are one box, saved with Save notes once changed"; "if someone else changed the job first, the notes are not saved and it says so"; ""Bike is here" is off until the bike is booked in, and turning it on books it in"; ""Bike is here" is on, and fixed, once the bike is in". Code: `job-dialog.tsx` (switch disabled for a pending booking; `saveNotes` shows the server's message; the notes box is not disabled on finished work, and the server's freeze refuses the save) |
| The job page lists and changes the job's work and parts | `screens/job-page-items.test.js`: "labour sits above parts"; "Add item finds a product and adds it to the job"; "a service is added as labour"; "scanning a barcode adds that product straight away"; "a part's quantity can be changed, and a line removed"; "if the server refuses, it says why" (pretend server); "a paid order cannot be changed here". Code: `src/screens/diary/work-parts.tsx` (editable only while the order is open); `job-dialog.tsx` (no-order message); `PUT /api/sale-documents/:id/items` (`This ${kind} is already ${status}`, e.g. "This order is already converted"; the test's "already completed" wording is a pretend-server stub) |
| The job page lists the days and can add or remove one | `screens/diary-multiday.test.js`: "the job page lists the days, is ready by the last one, and adds another day". `screens/job-page-edit.test.js`: "a later day can be removed; the first day cannot". Code: `job-dialog.tsx` (one-day text, days list only for more than one day, "Remove" with name "Remove day [n]", "Add another day" hidden once collected) |

## Not confirmed

Left out of the spec because no test or code showed it, or because the brief
put it elsewhere:

- **Another shop reading a job directly.** The code relies on row-level
  security and returns "Job not found"; no test reads another shop's job by
  its address (tests cover actions, attachments and the link only). The spec
  states isolation through those.
- **What a customer sees through the private link** (`online-booking`), and
  the link's 31-day expiry.
- **Files the customer added when booking** (each file carries a
  "from the customer" flag): tested only from the booking side
  (`portal-booking-photos.test.js`), so left to `online-booking`.
- **Listing jobs by old status** (`?status=`): in the code, no test.
- **The order a job list comes back in** (by date, then start time): code
  only, and nothing depends on it in a test; left out.
- **What an edit returns**: an edit's reply has no days list (the read does).
  Code only; left out as a detail, noted here.
- **The status word for a cancelled, declined, expired or reschedule-requested
  job.** `jobStage` does not look at those booking states, so such a job reads
  by its bike and work (a cancelled job whose bike is expected reads
  "Expected"). Code reading only, not tested; left out of the spec.
- **The `illegal` refusal on the job page.** The page shows the stale
  message for an "illegal" refusal as well as a "stale" one (code). Only the
  stale case is tested, so only that is in the spec.

## Differences from decisions and the older specs

For Jack to look at; nothing here is changed by this change.

1. **Paying for already-finished work is refused.** The job page's "Mark
   ready for collection" finishes the work; if the order is then paid at the
   till, payment is refused with "cannot finish a job that is complete; from
   here you can reopen", because finishing is only allowed from "in
   progress". Confirmed in the code, not covered by any test. Jack's 20 Sep
   decision (tendering must match the job's state) is followed literally, but
   the everyday order of "finish, then the customer pays" does not get
   through, and there is no clean way out: the job page has no reopen-work
   button; the old form's "Reopen job" sets the work to "not started", which
   is also refused at the till; and the old till saves the cart's items to
   the order before asking to convert it (`public/app.js`, the
   complete-sale handler), so the order has already changed when the payment
   is refused. Collect-and-pay is planned, which may be where this is meant
   to be answered.
2. **The bike and work moves ignore the booking, and the work ignores the
   bike.** A test walks "start" on a bike that is still expected; the
   reviewer's live probe booked in and started a job whose booking was
   cancelled (both 200). The job page only offers Start work once the bike
   is in and shows no stage button on a cancelled booking, but its "Bike is
   here" switch is still active for a cancelled, declined or expired booking.
3. **The old app's save is not guarded by the state rules.** Saving an
   old-app status turns it straight into states without checking the
   allowed moves (the code says so on purpose; it goes when `public/app.js`
   does). Worst case: the old form always sends its status dropdown, and an
   in-progress job reads "scheduled" there, so **every Save from the old form
   resets in-progress work to "not started"** (reviewer's probe confirmed).
   Saving "scheduled" on a cancelled, declined or expired job makes the
   booking scheduled again, which the action buttons treat as final.
   Reopening finished work this way sets the work to "not started", where
   the reopen-work action sets it to "in progress". On create, an old status
   of waiting_parts or on_hold also puts the bike in the shop.
4. **No hold button on the new job page.** "Hold" exists on the server and
   "On hold" has a status word and a Resume button, but the job page offers
   no way to put work on hold.
5. **Refusal messages show internal names**, e.g. "cannot book_in a job
   that is in_shop; from here you can collect". The code comment says the
   message is for people and may be reworded; the job page hides it behind
   its own words.
6. **Carry-over only happens when someone lists the jobs.** Nothing runs
   overnight; a job carries over the next time the diary loads.
7. **The multi-day spec says removing a day "isn't on the job page yet".**
   It is now (job page piece 2, "Remove day [n]"). The old spec is out of
   date, not the app.
8. **Status words.** The staff job page spec lists the badge words; the
   built page matches them, with the order Booking request, Collected,
   Finished, Waiting for parts, Quoting, On hold, In the workshop, Expected.
9. **Notes on finished work.** The job page's notes box stays editable on a
   finished job, but Save notes is refused with "This job is complete -
   reopen it before making changes." (the page shows the server's words).
10. **Attachments and the private link have no new screen.** Only the old
   app uses attachments; nothing calls the private-link route.
11. **A refused move that is also out of date is reported as "illegal"**,
   because the allowed-move check runs first. The job page shows the same
   "changed while you were looking" message for both, so staff see no
   difference.

## Risks / Trade-offs

- [A spec of the app as it is also records behaviour Jack may not want,
  such as item 1 above] → Each is listed under Differences, so Jack can
  decide; a later change fixes it and updates the spec.
- [Code-only evidence is weaker than a test] → The Evidence table says
  which rows rest on code alone, so a later change knows where to add tests
  first.
- [The boundary with `workshop-diary` is drawn here first] → Decisions 3–5
  above say what was put where, so the diary spec can pick up the rest.

## Migration Plan

None. Nothing is deployed. Archiving the change copies the spec to
`openspec/specs/workshop-jobs/spec.md`.
