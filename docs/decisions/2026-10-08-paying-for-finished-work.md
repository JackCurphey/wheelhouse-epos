# Paying for a repair whose work is already finished — Jack's decision (8 Oct 2026)

**The earlier decision** (Jack, 20 Sep, reaffirmed after a day on the other
behaviour; recorded only in the code, `POST /api/sale-documents/:id/convert`
and `tests/workshop-work-actions.test.js`): taking payment for a job's order
is the shop saying the work is done, so the job record governs. If the
record doesn't say the work is done, the payment is refused, and the shop
marks the job's real state first.

**What the code did.** It allowed payment only while the work was "in
progress", and finished the job as part of the payment. So once a mechanic
pressed "Mark ready for collection" — the shop's normal order, finish then
pay — the till refused the payment with "cannot finish a job that is
complete; from here you can reopen", with no clean way back. Found while
writing the workshop-jobs OpenSpec spec (8 Oct); confirmed by a fresh
reviewer on a test server.

**Decision** (Jack, 8 Oct: "1"). Payment is also accepted when the work is
already finished; the job is left as it is. Payment is still refused for
work not started, on hold or waiting for parts, so the record must still
say the work is done before money is taken. Chosen over keeping the rule
and adding a "Reopen work" button to the job page.
