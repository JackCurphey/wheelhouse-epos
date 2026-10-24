## ADDED Requirements

### Requirement: Staff refund a deposit by hand, with a reason

A job that took a deposit SHALL show it: the amount, when it was paid, and
whether it is paid, refunded or kept. Staff SHALL be able to refund it, the
whole amount, with a reason, at any stage, once; it goes back to the card the
customer paid with, and the job then shows when, why and who.

#### Scenario: Refunded by hand
- **WHEN** Jo refunds Maya's £13.00 deposit with the reason "Bike wasn't ready in time"
- **THEN** it goes back to Maya's card, and the job shows Deposit refunded £13.00 with the date and the reason

#### Scenario: No reason
- **WHEN** staff refund a deposit without a reason
- **THEN** it is refused, saying a reason is needed

### Requirement: Staff mark a booking that didn't come, keeping the deposit

Once a booking's day has gone and the bike never came in, staff SHALL be able
to mark it "Didn't come", keeping the deposit; the job then shows who marked
it and when, and the deposit can still be refunded by hand. Undo SHALL take
the mark off.

#### Scenario: Marked
- **WHEN** Maya's booking was yesterday and her bike never came in, and Jo presses Didn't come
- **THEN** the job is marked Didn't come by Jo, and the deposit is kept

#### Scenario: Too soon
- **WHEN** the booking is today or later, or the bike came in
- **THEN** Didn't come is refused
