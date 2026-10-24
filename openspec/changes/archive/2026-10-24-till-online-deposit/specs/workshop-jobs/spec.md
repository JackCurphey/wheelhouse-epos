## MODIFIED Requirements

### Requirement: Staff refund a deposit by hand, with a reason

A job that took a deposit SHALL show it: the amount, when it was paid, and
whether it is paid, refunded or kept. Staff SHALL be able to refund it, the
whole amount, with a reason, once, at any stage until the job's order is
paid; it goes back to the card the customer paid with, and the job then
shows when, why and who. Once the order is paid, the deposit is part of the
sale and SHALL NOT be refunded from the job (Jack, 24 Oct).

#### Scenario: Refunded by hand
- **WHEN** Jo refunds Maya's £13.00 deposit with the reason "Bike wasn't ready in time"
- **THEN** it goes back to Maya's card, and the job shows Deposit refunded £13.00 with the date and the reason

#### Scenario: No reason
- **WHEN** staff refund a deposit without a reason
- **THEN** it is refused, saying a reason is needed

#### Scenario: After the job is paid
- **WHEN** Maya's job was paid at the till with her deposit counted, and Jo tries to refund the deposit
- **THEN** it is refused: "This deposit paid part of the bill at the till, so it can't be refunded from the job."
