# Design

After `answerAndAddToOrder` succeeds for `via = 'phone'`, the route queues
`your_answers` through `jobMessageVars`, with no wait: the answer is final
and was given on the call, as booking answers send at once (Jack, 22 Oct,
`2026-10-22-booking-answers-at-once`). A fault there is logged; the answer is
saved either way, and the reply is unchanged.

[What was agreed], built from the quote's lines with the database's sums:
"Going ahead: Shimano brake pads and Fit and adjust brakes, £46.00. No
thanks: Replace gear cable." With nothing agreed: "Going ahead: just the
booked work. No thanks: …". With nothing declined, only "Going ahead: …".

Answers recorded "in the shop" send nothing: the drawn Settings row is "from
a call", and the customer was there.
