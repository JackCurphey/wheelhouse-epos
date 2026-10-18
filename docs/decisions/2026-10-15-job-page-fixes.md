# The job page's known problems from issue #190 (15 Oct 2026)

Four of the problems recorded in #190 while writing the `workshop-jobs`
spec. Jack, 15 Oct, chose to fix them now rather than with stage 4's job
page, one question each. No drawing shows any of them. Built in
`openspec/changes/archive/*-job-page-hold-words-notes`.

1. **Put on hold** (Jack: "1"). A quieter second button beside the main one
   in the job page's bottom bar, while the job is Expected, Booked in, In
   the workshop or Waiting for parts. Chosen over the Status dropdown only,
   and over no Hold button.
2. **Refusals in plain words** (Jack: "1"). A refused move is explained from
   where the job is, such as "The bike is already here."; "This job changed
   while you were looking at it." only when someone else did change it.
   Quote refusals too. The sentences are in Jack's section of
   `decided-while-building.md`. Chosen over keeping "This job changed…" for
   every refused stage button.
3. **Notes on finished work** (Jack: "1"). Read-only, with "Reopen the job to
   change its notes." Chosen, for now, over letting finished jobs' notes
   change, which needs the server's rule that freezes finished work to
   change (Mark's).
4. **Words for bookings that ended or wait on a change** (Jack: "1").
   "Change requested" in the diary's amber; "Cancelled", "Declined" and
   "Expired" in its grey. This answers stage 1 gaps decision 25 (a Change
   requested badge on the job window). Chosen over showing declined and
   expired bookings as "Cancelled".

### 16 Oct 2026: "Bike is here" on an ended booking (issue 190 A)

5. **An ended booking whose bike is in the shop keeps "Bike is here" on,
   greyed and fixed** (Jack: "1"), because the bike really is there. A
   booking that ended before the bike came in stays off and fixed, as
   built in #223. No screen change. Stopping the server booking in or
   starting work on an ended booking (the rest of #190 A) is Mark's, when
   he is back. Chosen over showing it off for every ended booking, and over
   hiding the switch. This narrows "off and fixed" in Jack's section of
   `decided-while-building.md` (15 Oct, plain refusals, item 3) to a
   booking whose bike never came in.
