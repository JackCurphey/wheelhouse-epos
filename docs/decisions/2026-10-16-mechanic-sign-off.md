# Mechanic sign-off (16 Oct 2026)

Workshop day decision 64 (`2026-09-27-workshop-day-review.md`, Jack, 29 Sep):
a mechanic signs a job off, putting their name to it and saying it's fine to
go out, so if a job comes back the shop can see who worked on it and who
passed it. It was "not yet designed"; the build board listed it as still to
design (stage 4). Jack, 16 Oct, one question each.

1. **Signing off is part of finishing the job** (Jack: "1"). "Mark ready for
   collection" asks "Who's signing this off?", with the same pick-your-name
   pills the workshop computer uses for "Who's working?". Chosen over a
   separate check after the job is finished, and over an optional button.
2. **The job's own mechanic is picked for you, and can be changed** (Jack:
   "1"): usually one tap to confirm; tap another name if someone else
   checked it. Chosen over nobody picked, and over only someone other than
   the job's mechanic.
3. **Staff always see it; each shop chooses whether customers do** (Jack:
   "3"). The job page shows "Signed off by [name], [day], [time]" and it
   stays in the job's history. A shop setting adds it to the customer's
   receipt and booking link ("Checked by [name]"); it starts off, so no
   staff names reach customers until a shop chooses (Claude's default, for
   Jack to overrule). Chosen over staff only, and over always showing
   customers.
4. **Reopening clears the sign-off; finishing again asks again** (Jack:
   "1"). The earlier sign-off stays in the job's history. Chosen over
   keeping the original sign-off.
5. **Taking payment for a job still in progress asks for a sign-off too**
   (Jack: "yes", option 1): the till asks "Who's signing this off?" with the
   same pills before it finishes the job, so every job that goes out is
   signed, whichever way it was finished. Chosen over letting those jobs go
   out unsigned.

**Still to do:** draw it (the "Mark ready for collection" step, the job
page's line, the till's question and the shop setting) before it is built in
stage 4; the sign-off needs a place on the server to keep who and when
(Mark's half).
