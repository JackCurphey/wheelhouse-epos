## ADDED Requirements

### Requirement: The till takes a deposit on a job at any stage

On a workshop job's open order, Take payment SHALL offer Deposit, whatever
stage the work is at (Jack, 24 Oct, `docs/decisions/2026-10-24-till-deposit-unfinished-work.md`).
"Take [amount] now" SHALL take it by card, cash or both and record it against
the job's order, without making a sale, changing the work or recording the
bike as collected. More than one deposit MAY be taken on a job, each shown
on its own.

#### Scenario: A deposit at drop-off
- **WHEN** Maya Patel's job WH-1042 has a £111.00 bill, its work not started, and Jo takes £27.75 by card
- **THEN** £27.75 is recorded against the order, no sale is made, the work stays not started and the bike stays in

#### Scenario: A deposit doesn't ask who signed off
- **WHEN** WH-1042's work is in progress and Jo takes a deposit
- **THEN** the till doesn't ask "Who's signing this off?" and the work stays in progress

#### Scenario: Pressed twice
- **WHEN** the same deposit is sent twice, as a second tap or a retry
- **THEN** one deposit is recorded, and the second reply gives the same deposit and what's left

### Requirement: The deposit pop-up offers a share of the bill

Deposit SHALL open "Take a deposit · job [reference] · [bill]" with 10%, 25%,
50% and Other, none chosen at first, the rows "Deposit now" and "Paid at
collection", and "Bike stays in." (`till-job-deposit`). The bill it shows
SHALL be the job's order plus each booked service not on the order yet, and
a percentage SHALL be of that bill, rounded to the nearest penny.

#### Scenario: Choosing 25%
- **WHEN** Jo opens Deposit on WH-1042's £111.00 bill and presses 25%
- **THEN** Deposit now reads £27.75, Paid at collection £83.25, and the button reads "Take £27.75 now"

### Requirement: Paid says what's left after a deposit

After a deposit, the Paid box SHALL say "Deposit taken. [left] is left to pay
at collection." and offer Print and No receipt, without Email.

#### Scenario: Paid after a deposit
- **WHEN** Jo takes £27.75 by card on WH-1042's £111.00 bill
- **THEN** Paid says "Deposit taken. £83.25 is left to pay at collection."

### Requirement: A deposit is always less than what's left to pay

A deposit SHALL be at least 1p and less than what's left to pay on the job:
the job's order plus each booked service not on the order yet, less any
online deposit counted and deposits already taken. A deposit is then never
the payment that pays the job off (Jack, 16 and 24 Oct). A larger one SHALL
be refused with `deposit_too_much`, "A deposit must be less than the
£[left] left to pay. The rest is paid when the work is finished."

#### Scenario: The whole bill as a deposit
- **WHEN** Jo tries to take £111.00 as a deposit on WH-1042's £111.00 bill
- **THEN** it is refused with `deposit_too_much` and nothing is recorded

#### Scenario: A booked job at drop-off
- **WHEN** a job was booked for a service and its order has nothing on it yet
- **THEN** Deposit shows the service's booked price as the bill, and a deposit under it is taken

### Requirement: A job with nothing on its bill takes no deposit

A job with no booked service and nothing on its order SHALL refuse a
deposit with `nothing_on_bill`, "There’s nothing on this job’s bill yet. Add
the work in Work and parts, then take a deposit."

#### Scenario: Nothing booked and nothing on the bill
- **WHEN** a job has no booked service and nothing on its order
- **THEN** Deposit can't be chosen, and a deposit sent anyway is refused with `nothing_on_bill`

### Requirement: A deposit needs an open job's order and a live booking

A deposit SHALL be refused on anything but a workshop job's order
(`not_a_job`), an order that isn't open, and a booking that has been
declined, has expired or was cancelled (`booking_ended`, "This booking has
ended, so a deposit can't be taken."). A booking waiting for an answer,
offered, booked, asking to move, or marked Didn't come SHALL take a deposit.

#### Scenario: A cancelled booking
- **WHEN** the job's booking was cancelled
- **THEN** a deposit is refused with `booking_ended`

#### Scenario: A quote linked to a job
- **WHEN** a deposit is sent for a quote linked to a job
- **THEN** it is refused with `not_a_job` and nothing is recorded

### Requirement: Paying the rest takes every deposit off

When a job with deposits taken at the till comes back, the till SHALL show a
"Deposit paid" line for each, "[date] · card", "· cash" or "· cash and card",
taken off, and take only what's left (`till-job-balance`), with "Bike
collected when paid" on again. Paying the rest SHALL still need the work in
progress or finished.

#### Scenario: Collecting after a deposit
- **WHEN** WH-1042's work is finished, £27.75 was taken at the till, and Jo takes payment by card
- **THEN** the till shows Deposit paid −£27.75, asks for £83.25, and records the bike as collected

#### Scenario: The rest before the work is finished
- **WHEN** a deposit was taken and the work is on hold
- **THEN** Card, Cash and Split can't be chosen, and paying the rest is refused before any sale is made

### Requirement: Nothing left to pay still finishes the job

When what's left to pay is £0.00, because the work is free or the bill came
down to exactly the deposits taken, Take payment SHALL still open and
Card or Cash SHALL take £0.00, making the one sale with the deposits as its
payment and finishing the job, as free work is finished today.

#### Scenario: The bill comes down to the deposit
- **WHEN** work is declined after a deposit, so the bill equals the deposit, and the work is finished
- **THEN** Take payment reads £0.00, and taking it makes one sale paid by "Deposit paid at the till" and records the bike as collected

### Requirement: The sale that pays the rest carries the whole bill once

Paying the rest SHALL make one sale with the job's full lines and total,
recording the deposits as one payment, "Deposit paid at the till", worked out
by the server and never taken from the till. A deposit SHALL appear in the
shop's sales only inside that sale, so the job's money is counted once.

#### Scenario: The sale's payments
- **WHEN** Jo takes the £83.25 left on WH-1042 by card
- **THEN** the sale's total is £111.00, paid £27.75 "Deposit paid at the till" and £83.25 by card, and the shop's sales hold that one sale for the job and no other

#### Scenario: A deposit online and one at the till
- **WHEN** a job had £13.00 paid online and 10% (£6.50) taken at the till on a £65.00 bill
- **THEN** the till asks for £45.50, and the sale records £13.00 Deposit paid online, £6.50 Deposit paid at the till and £45.50 by card or cash

### Requirement: Paying is refused while the deposits are more than the bill

When the bill drops below the deposits taken, the till SHALL say "The
deposits taken are more than the bill: refund one on the job before taking
payment." with Take payment greyed, and paying SHALL be refused with
`deposits_over_bill` before any sale is made.

#### Scenario: Work declined after a deposit
- **WHEN** work is declined after a deposit, so the bill is less than the deposits taken
- **THEN** Take payment is greyed and paying is refused with `deposits_over_bill`

### Requirement: A deposit has its own receipt

After a deposit, Print SHALL print a receipt headed "Deposit [n]" with the
job and bike, "Deposit on the job" and its amount, how it was paid, and "Left
to pay [amount]", with the shop's details and words and no barcode. The sale
that pays the rest SHALL print "Paid by Deposit paid at the till" with the
deposits' amount.

#### Scenario: Printing a deposit's receipt
- **WHEN** Jo takes £27.75 by card on WH-1042 and presses Print
- **THEN** the receipt says "Deposit [n]", "WH-1042 · Trek Domane AL 3", "Deposit on the job £27.75", "Paid by card £27.75" and "Left to pay £83.25"

## MODIFIED Requirements

### Requirement: The till pays a workshop job's order
Opened with a job (Jack, 18 Oct, `docs/decisions/2026-10-18-till-job-payment.md`), the till SHALL show the job's order lines locked, each marked "agreed on the job", with the customer and job, and "Bike collected when paid", on by default while the bike is in the shop. Take payment SHALL pay what's left of the order, every deposit taken off. Then, unless the pill is off, it SHALL record the bike as collected. A deposit SHALL NOT record the bike as collected.

#### Scenario: Paying for a finished job
- **WHEN** staff open WH-1042 in the till and pay its £83.00 by card
- **THEN** the order is paid, the job stays finished, and the bike is recorded as collected

#### Scenario: The bike stays
- **WHEN** staff switch off "Bike collected when paid" and pay
- **THEN** the order is paid and the bike stays in the shop

### Requirement: The till says when a job can't be paid
An order already paid SHALL say "This job’s order is already paid." with nothing to take. Work not yet in progress or finished SHALL say "The work isn’t finished, so this job can’t be paid yet."; Take payment SHALL still open, offering only Deposit, with Card, Cash and Split unavailable.

#### Scenario: Work not started
- **WHEN** the job's work hasn't started
- **THEN** the till says "The work isn’t finished, so this job can’t be paid yet.", and Take payment offers Deposit with Card, Cash and Split unavailable

### Requirement: The till asks who is signing off a job its payment finishes
When a job's work is still in progress, choosing Card, Cash or Split to pay the rest SHALL first ask "Who’s signing this off?", the same pop-up as Mark ready for collection, with the job's mechanic picked (Jack, 16 Oct, answer 5). Signing off SHALL go on to the payment, which records the sign-off; Cancel SHALL take nothing. Work already finished SHALL be paid without asking, and a deposit SHALL never ask.

#### Scenario: Paying for work in progress
- **WHEN** WH-1042's work is in progress and staff choose Card on Take payment
- **THEN** the till asks who is signing it off, with Alex Morgan picked, before the card step

#### Scenario: Paying for finished work
- **WHEN** WH-1042 was already marked ready and signed off
- **THEN** Card, Cash and Split go straight to the payment
