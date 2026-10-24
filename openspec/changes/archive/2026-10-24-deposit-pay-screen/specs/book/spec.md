## ADDED Requirements

### Requirement: The customer pays the deposit on step 4 before the booking is sent

When the shop takes a deposit, step 4 SHALL show the deposit part drawn in
`bk-details-deposit` with the amount, the refund and cancel lines and the card
form, the summary SHALL show "Deposit to pay now", and the button SHALL read
"Pay £[deposit] and send request", or "Pay £[deposit] and book" when the shop
confirms automatically. Pressing it SHALL pay, then send the booking.

#### Scenario: Paid and sent
- **WHEN** the shop takes 20% of a £65.00 service and the customer enters an accepted card and presses Pay £13.00 and send request
- **THEN** the deposit is held, the booking is sent with it, and the customer is taken to their booking

#### Scenario: A declined card
- **WHEN** the card is declined
- **THEN** "The card didn't go through. Nothing was taken and nothing is booked yet. Try again, or use another card." shows, the button reads Try again, and nothing is sent

#### Scenario: The connection drops after paying
- **WHEN** the card was accepted and the booking couldn't be sent
- **THEN** "We're checking whether your payment went through — please don't pay again." shows with Check again, which sends the same booking without paying again

#### Scenario: No deposit
- **WHEN** the shop takes no deposit
- **THEN** step 4 has no deposit part and its button is as before
