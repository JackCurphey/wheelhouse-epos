# The till's warning when a job changes while it is being paid for (16 Oct 2026)

Issue #196. When the new till pays for a job (WP-3.1) and the job changes
between the till's check and the payment going through, the payment still
goes through (a sale is never refused) and goes on "check these"
(`2026-10-16-till-paying-orders.md`, item 1). The drawings don't show what
staff see, so the look went to Jack. Jack, 16 Oct, one question each.

1. **An amber line on the Paid box, the 5-second countdown stops, and an
   "Open the job" button sits beside the receipt buttons** (Jack: "1"). The
   box stays until staff close it. It follows the till's "warned, never
   blocked" pattern (`till-held-job`, `generator/till.mjs`). Chosen over
   the line with the countdown carrying on, and over a separate pop-up after
   Paid.
2. **Two sentences, one per case** (Jack: "1"), draft wording for Q9's
   read-through:
   - The work couldn't be marked finished: "Paid, but the work isn't
     finished: [where the job is]. Open the job to check it.", where the
     middle part uses the job page's own words (`refusal-words.ts`), such as
     "the job is on hold" or "the job is waiting for parts".
   - The work was finished and someone reopened it: "Paid, but someone
     reopened this job while it was being paid for. Open the job to check
     it."
   Chosen over one sentence for both.

**For Mark (server half of WP-3.1):** the payment's answer needs to say
which case happened and, for the first, where the job is, so the till can
build these sentences; the server's own messages (today in
`POST /api/sale-documents/:id/convert`) needn't be shown to staff.

**Still to draw:** the Paid box with the amber line, in `generator/till.mjs`,
when WP-3.1's screens are specified.
