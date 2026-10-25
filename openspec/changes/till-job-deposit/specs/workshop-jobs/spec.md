## ADDED Requirements

### Requirement: The job page shows each deposit taken at the till

The job page SHALL show each deposit taken at the till: the amount, when, "at
the till", and whether it is paid or refunded, with Refund the deposit while
it is held and the job's order isn't paid. Cancelling, declining or expiring
the booking SHALL leave a till deposit as it is.

#### Scenario: A deposit taken at drop-off
- **WHEN** Jo took £27.75 by card on WH-1042 at the till
- **THEN** the job page shows Deposit paid £27.75, the date and "at the till", with Refund the deposit

#### Scenario: The booking is cancelled
- **WHEN** the shop cancels a booking that has a till deposit
- **THEN** the deposit stays shown as paid, with Refund the deposit

### Requirement: Staff refund a deposit taken at the till by hand, with a reason

Staff SHALL be able to refund a till deposit, the whole amount, with a
reason, once, until the job's order is paid. The amount SHALL come off what
was paid on the order, and the job then shows when and why. Once the order is
paid, the deposit is part of the sale and SHALL NOT be refunded from the job
(Jack, 24 Oct, `docs/decisions/2026-10-24-deposit-after-paid.md`).

#### Scenario: Refunded by hand
- **WHEN** Jo refunds Maya's £27.75 deposit with the reason "Bike wasn't ready in time"
- **THEN** the job shows Deposit refunded £27.75 with the date and the reason

#### Scenario: No reason
- **WHEN** staff refund a till deposit without a reason
- **THEN** it is refused, saying "Say why the deposit is being refunded"

#### Scenario: After the job is paid
- **WHEN** Maya's job was paid at the till with her deposit counted, and Jo tries to refund that deposit
- **THEN** it is refused: "This deposit paid part of the bill at the till, so it can't be refunded from the job."

### Requirement: A till deposit's refund says how to give the money back

The refund pop-up SHALL say how the money goes back, the way it was paid:
"Give £[n] back in cash from the drawer." for cash, "Key a refund of £[n]
into the card machine, to the card they paid with." for card, and both for a
deposit paid partly each way.

#### Scenario: A card deposit
- **WHEN** Jo opens Refund the deposit on Maya's £27.75 card deposit
- **THEN** the pop-up says "Key a refund of £27.75 into the card machine, to the card they paid with."

### Requirement: A job's order with a till deposit can't be cancelled or moved

Cancelling a job's order, or moving it to another job or off any job, while
a deposit taken at the till is held SHALL be refused with `deposit_held`, "A
deposit was taken at the till on this order. Refund it on the job first.",
and nothing changes. A job with more than one order SHALL show the till
deposits on each of them.

#### Scenario: Cancelling the order
- **WHEN** staff cancel WH-1042's order with £27.75 held
- **THEN** it is refused with `deposit_held` and the order stays open

#### Scenario: Moving the order off the job
- **WHEN** staff unlink WH-1042's order from the job, or link it to another job, with £27.75 held
- **THEN** it is refused with `deposit_held`, the order stays on WH-1042, and deleting WH-1042 is still refused

### Requirement: The job page won't offer to delete a job holding a till deposit

With a till deposit held, Delete on the job page SHALL go straight to the
existing "Settle up first" words saying to refund what was paid, without
first asking to delete.

#### Scenario: Delete with a deposit held
- **WHEN** staff press Delete on WH-1042 with £27.75 held
- **THEN** the pop-up says to refund what was paid first and offers no delete

## MODIFIED Requirements

### Requirement: Staff can delete a job
Staff SHALL be able to delete a job without sending a version, unless money has been paid on its order (a payment, or a deposit taken at the till and not refunded) or the bike is in the shop (Jack, 18 Oct, `docs/decisions/2026-10-18-attachments-and-delete.md`). Then the delete SHALL be refused with the code `settle_first`, saying which of the two applies. Its order SHALL be kept, no longer linked to any job, so nothing already added to it is lost. Its attached files SHALL be removed with it. Any message to the customer about the job still waiting to go SHALL be stopped with it, as Undo stops one, so nothing is sent about a job that no longer exists; a message already on its way or sent SHALL be left as it is. A delete and a quote answer for the same job at the same moment SHALL each go through or be refused in plain terms, one after the other, never failing with a server error. Deleting a job that does not exist SHALL be refused as not found.

#### Scenario: Deleting a job keeps its order
- **WHEN** staff delete a job that has an order
- **THEN** the job can no longer be read, and the order still exists with no job linked

#### Scenario: Deleting a job that is not there
- **WHEN** staff delete a job that does not exist
- **THEN** it is refused as not found

#### Scenario: The bike is in the shop
- **WHEN** staff delete a job whose bike has been booked in
- **THEN** it is refused with `settle_first`, the bike in the shop, and the job remains

#### Scenario: The order is paid
- **WHEN** staff delete a job whose order has been paid
- **THEN** it is refused with `settle_first` and money paid

#### Scenario: A deposit taken at the till
- **WHEN** staff delete a job with a deposit taken at the till and not refunded
- **THEN** it is refused with `settle_first` and money paid; once the deposit is refunded, the delete goes ahead and the order is kept

#### Scenario: A Bike ready still in its minute
- **WHEN** staff delete a job whose "Bike ready" message is still waiting its minute
- **THEN** the message is marked undone and is never sent

#### Scenario: A refused delete stops nothing
- **WHEN** a delete is refused with `settle_first`
- **THEN** the job's waiting messages are still waiting

#### Scenario: A quote is answered as the job is deleted
- **WHEN** a quote on a job is being answered and staff delete the job at the same moment
- **THEN** neither gets a server error: the answer goes in first and the job is then deleted with its order kept, or the job is deleted first and the answer is refused as not found
