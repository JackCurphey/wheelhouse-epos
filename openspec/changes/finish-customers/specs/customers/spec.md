# Spec Delta

Jack answered the main questions on 9 Nov (`docs/decisions/2026-11-09-answers.md`). Lines marked **[Q n]** follow a small default in `design.md` § Open questions, question n, for Jack to overrule.

## ADDED Requirements

### Requirement: A bike bought here shows each of its warranty lines
A customer's bike bought at the shop SHALL show "Bought here [date]" and each of its warranty lines with its own end, on the customer page's Bikes list and in the Warranty block of the bike's own page (`cs-page`, `cs-bike`; customer service decision 4; Jack, 9 Nov, answer 3). A running line SHALL read "until [date], [n] months left" or "lifetime"; an ended one "ended [date]". [Q 19] A bike not bought here SHALL show no warranty.

#### Scenario: Maya's Trek, under warranty
- **WHEN** Maya Patel's Trek Domane AL 3 was bought here on [date] and Trek's lines are Frame lifetime and Components 2 years
- **THEN** her Bikes list shows "bought here [date]" and "Under warranty · Frame: lifetime · Components: until [date], [n] months left", and the bike's page shows the same lines under "Warranty" with "Bought here [date]"

#### Scenario: A Trek e-bike
- **WHEN** the bike bought here is a Trek e-bike
- **THEN** it also shows "Electronics: until [date], [n] months left"

#### Scenario: Components ended, frame still running
- **WHEN** a Cube bought here has a 10-year frame and its 2 years of components have passed
- **THEN** it shows "Under warranty · Frame: until [date], [n] months left · Components: ended [date]"

#### Scenario: Every line ended
- **WHEN** every line has ended
- **THEN** it shows "Warranty ended [date]", the latest line's end

#### Scenario: Less than a month left on a line
- **WHEN** fewer than 31 days are left on a line
- **THEN** that line reads "until [date], less than a month left" [Q 15]

#### Scenario: A bike from elsewhere
- **WHEN** a bike was added by staff or by the customer and never bought here
- **THEN** its page has no Warranty block and its row no warranty line

#### Scenario: Bought here, but no lines for its brand
- **WHEN** a bike bought here has a brand with no warranty lines, or no brand
- **THEN** it shows "Bought here [date]" and no warranty line

### Requirement: A bike sold here joins its customer's bikes
When a bike with a recorded frame number is sold to a customer, it SHALL be added to that customer's Bikes (or the bike with that frame number they already have SHALL be used), marked bought here on the sale's day, with each warranty line's end worked out from that day and the lines of its product (its own, or its brand's), Electronics only for an e-bike. This SHALL happen only once a sale records a frame number, which comes with the till's half (Jack, 9 Nov, answer 1).

#### Scenario: Selling a Trek with its frame number
- **WHEN** a Trek Domane AL 3 is sold to Maya on [date] with frame number [frame number], and Trek's lines are Frame lifetime and Components 2 years
- **THEN** Maya's Bikes gains the Trek with that frame number, "bought here [date]", "Frame: lifetime" and "Components: until [date]" two years on

### Requirement: Staff record a bike bought here before Wheelhouse
A bike's Edit SHALL let staff record "Bought here on" for a bike sold before the shop used Wheelhouse, with its brand (from Bike warranties, starting at the one matching its Make) and, if wanted, its model (a product of that brand, for a model's own lines), and whether it is an e-bike (starting from the model's). Its warranty lines' ends SHALL follow from that date and those lines, worked out when saved. Clearing "Bought here on" SHALL remove its warranty (Jack, 9 Nov, answer 4).

#### Scenario: A Trek sold in the Citrus Lime years
- **WHEN** Jo records that Maya's Trek was bought here on [date], brand Trek, no model
- **THEN** the bike shows "Bought here [date]" and Trek's lines with their ends from that date

#### Scenario: A brand not in the list
- **WHEN** the bike's Make isn't one of Bike warranties' brands
- **THEN** the brand starts empty, staff can pick one, and with none picked it shows "Bought here [date]" and no warranty

#### Scenario: Not a sensible date
- **WHEN** "Bought here on" is after today
- **THEN** it isn't saved and says the date can't be in the future

### Requirement: Logging a privacy request by hand
The Owner SHALL be able to log a privacy request with "+ Log a request" (`cs-privacy`): the customer (found as the header search finds them), what they asked for (a copy of their data, or deleting their details), how they asked [Q 7] and the day they asked (today or earlier, never later). The answer is due one month from the day they asked. Nobody but the Owner SHALL log one.

#### Scenario: Maya asks at the counter
- **WHEN** Jack Lewis logs that Maya Patel asked in person on [date] for a copy of her data
- **THEN** the list shows "Maya Patel · Copy of their data", how she asked, "Asked [date] · answer by [date]", with Send the copy

#### Scenario: A letter that arrived last week
- **WHEN** Jack logs a request asked on a day more than a month ago
- **THEN** it shows Overdue at once

#### Scenario: Not the Owner
- **WHEN** a staff member tries to log a request
- **THEN** they are refused

### Requirement: Sending the copy
On an open copy-of-their-data request, "Send the copy" SHALL give the Owner the customer's full copy, the account's copy with the shop's own notes about them and their bikes added (Jack's 30 Oct answer 1), to download, and to email when the customer has an email (Jack, 9 Nov, answer 6). Sending SHALL mark the request done with the day.

#### Scenario: Sending Maya her copy
- **WHEN** Jack Lewis presses Send the copy on Maya's request and chooses Email it
- **THEN** one email with her copy is queued to maya@example.test, and the row shows "Asked [date] · done [date]" and Done

#### Scenario: No email
- **WHEN** the customer has no email
- **THEN** only Download it is offered, and downloading marks the request done

#### Scenario: Not the Owner
- **WHEN** a staff member asks for the copy
- **THEN** they are refused and nothing is sent

### Requirement: Store credit is lost on deletion, and the loss is kept
Deleting someone's details SHALL set their store credit to zero with an entry "Lost when their details were deleted", kept without their name for the shop's books. A deletion request whose customer holds store credit SHALL show it on its row, without holding the deletion back (account and reminders audit M12).

#### Scenario: Maya holds credit when deleted
- **WHEN** Maya Patel, holding [£] store credit, has her details deleted
- **THEN** her request row had shown "Store credit [£] will be lost", and after deleting the books keep an entry of [£] lost with no name

## MODIFIED Requirements

### Requirement: A bike still in the workshop holds a deletion back
A deletion request whose customer has a bike still in the workshop SHALL say "Still in the way: bike in the workshop, [ref]" and hold Delete back until it is collected. A customer who owes on account SHALL likewise hold it back, with "Still in the way: owes on account [£ owed]", until it is paid (customer service decision 12(2)). Nothing else SHALL hold it back.

#### Scenario: Her bike is still in
- **WHEN** her bike is in the workshop as WH-1042
- **THEN** the row says "Still in the way: bike in the workshop, WH-1042", Delete is held back, and "Can be deleted once the bike is collected." shows

#### Scenario: Collected
- **WHEN** her bike is collected after she asked
- **THEN** Delete is no longer held back

#### Scenario: She owes on account
- **WHEN** Maya owes [£ owed] on account
- **THEN** the row says "Still in the way: owes on account [£ owed]", Delete is held back, and the server refuses a deletion until she owes nothing
