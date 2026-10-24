## ADDED Requirements

### Requirement: The job pop-up shows the deposit and refunds it by hand

A job that took a deposit SHALL show it in a strip under the customer strip
as drawn: paid, with Refund the deposit; refunded, with the date and reason;
or kept after Didn't come, with who and when, and Refund the deposit. Refund
the deposit SHALL open the drawn pop-up, needing a reason, and refund the
whole deposit.

#### Scenario: Refunded by hand
- **WHEN** Jo presses Refund the deposit, types "Bike wasn't ready in time" and presses Refund £13.00
- **THEN** the strip reads Deposit refunded £13.00 with the date and the reason

### Requirement: The job pop-up marks a booking that didn't come

Once the booked day has gone with the bike not in, the job pop-up SHALL say
"Not come in" with the booked day and time, and offer Didn't come beside Book
in. Pressing it SHALL mark the job Didn't come, keeping the deposit, with
"Marked Didn't come · the deposit is kept" and Undo until the job is closed.

#### Scenario: Marked, then undone
- **WHEN** Jo presses Didn't come, then Undo
- **THEN** the job reads Didn't come with the bar, then Expected again
