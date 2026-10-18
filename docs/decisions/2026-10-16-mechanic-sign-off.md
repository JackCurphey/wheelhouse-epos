# Mechanic sign-off (16 Oct 2026)

Workshop day decision 64 (`2026-09-27-workshop-day-review.md`, Jack, 29 Sep):
a mechanic signs a job off, putting their name to it and saying it's fine to
go out, so if a job comes back the shop can see who worked on it and who
passed it. It was "not yet designed"; the build board listed it as still to
design (stage 4). Jack, 16 Oct, one question each.

1. **Signing off is part of finishing the job** (Jack: "1"). "Mark ready for
   collection" asks "Who's signing this off?", with the shop's mechanics as
   pills to tap, as when choosing a mechanic (Workshop day decisions 62 and
   66). (Not the "Who's working?" pills: those exist only with the PIN check
   on and list only who signed in on that computer today.) Chosen over a
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
   customers. Showing staff names to customers falls under the solicitor's
   check of what staff must be told (`docs/runbooks/go-live-checklist.md`).
4. **Reopening clears the sign-off; finishing again asks again** (Jack:
   "1"). The earlier sign-off stays in the job's history. Chosen over
   keeping the original sign-off.
5. **The payment that finishes a job still in progress asks for a sign-off
   too** (Jack: "yes", option 1): the till asks "Who's signing this off?"
   with the same pills before it finishes the job, so every job that goes
   out is signed, whichever way it was finished. A deposit doesn't finish a
   job, so it doesn't ask (deposits at any stage, Jack, 16 Oct,
   `2026-10-16-till-paying-orders.md`, in #231). Chosen over letting those jobs go
   out unsigned.
6. **No PIN to sign off: tap the name** (Jack: "1"), as the rest of the
   workshop works today. Whether it asks for the PIN once a shop switches the
   PIN check on is settled when that check is built.
7. **A job in the shared queue has nobody picked**; someone taps a name
   (Jack: "1"). Chosen over picking whoever is signed in on that computer.
8. **A job reopened while it is being paid for** (the till's job warning,
   `2026-10-16-till-job-warning.md`): the payment stands, the sign-off is
   cleared, and finishing again asks again, as answer 4 already says.

The old app (`public/app.js`) keeps finishing jobs without a sign-off until
its screen is replaced; it is not changed.

**Still to do:** draw it (the "Mark ready for collection" step, the job
page's line, the till's question and the shop setting) before it is built in
stage 4; the sign-off needs a place on the server to keep who and when
(Mark's half).

**Drawn, 17 Oct:** Jack approved three pictures: the "Who's signing this
off?" pop-up over the job page (mechanics as pills, the job's mechanic
picked, Cancel and "Sign off and mark ready"); "Signed off by [name] ·
[day], [time]" under the finished job's strip; and the shop setting "Show who
signed off to customers", off. They are `signOffDrawings()` in
`docs/design/user-journeys/generator/diary.mjs`, not on the canvas yet. The
till's payment that finishes a job uses the same pop-up.

## Building it (18 Oct 2026)

Jack, 18 Oct, asked what the first piece covers: **piece 1, the sign-off on
"Mark ready for collection" and the "Signed off by" line, including two
columns on the job and a new table keeping every sign-off** (Jack: "Yes:
start with piece 1, the sign-off on Mark ready for collection and the Signed
off line, including the two job columns and the new sign-off history
table"). The table keeps answer 4's earlier sign-offs before the job history
(WP-1.2) exists. Chosen over the columns alone. The till's question (answer
5) and the customer setting (answer 3) are later pieces; until the till's is
built, a job finished by paying at the till goes out unsigned.

**A deleted mechanic's sign-offs keep their name** (Jack, 18 Oct, after the
fresh review found a mechanic who had signed off couldn't be deleted: "1:
keep their name. Each sign-off saves the mechanic's name when they sign, so
deleting them later still works and old jobs still say who signed off").
Chosen over refusing the delete and over forgetting who.

**Merged with the server change flagged for Mark** (Jack, 18 Oct: "1: merge
once GitHub's checks pass, and flag the server and database change for Mark
in the status update"), as #265 and #267 were.

**Piece 2, the till asking too, merged with its `sales.js` change flagged for
Mark** (Jack, 18 Oct: "Yes: merge #273 once GitHub's checks pass, and flag
the sales.js change for Mark in the status update").
