## MODIFIED Requirements

### Requirement: A customer's change request shows where the customer wants to go
A booking with a customer's change request waiting SHALL show amber at its current time, and a dashed outline reading "Requested [time]" at the time the customer asked for, when that time falls in a day and column on screen, also in a week where the booking itself is not (Jack, 15 Oct). A screen reader SHALL hear "[bike] asks to move here: [time]", or "[customer] asks to move here: [time]" in a week without the booking. The outline of a request chosen from "Waiting for you" SHALL be marked as its block is.

#### Scenario: Oliver Chen asks to move
- **WHEN** Oliver Chen's Brompton C Line is booked at 10:00 on Monday 5 October and he asks for 14:00 the same day
- **THEN** the block reads Change requested and Monday shows "Brompton C Line asks to move here: 14:00–15:00"

#### Scenario: Oliver Chen asks for another week
- **WHEN** Oliver Chen's Brompton C Line is booked at 10:00 on Monday 5 October, he asks for 14:00 on Wednesday 14 October with Alex Morgan, and staff choose his card
- **THEN** the diary shows "12–18 October 2026" and Wednesday shows "Requested 14:00" and "Oliver Chen asks to move here: 14:00–15:00, chosen from Waiting for you"

### Requirement: The diary's Waiting column chooses and opens what is waiting
On a computer or tablet the diary SHALL show "Waiting for you ([n])" beside the grid, refreshed every minute, one card per item with its kind, the customer, and the services and time or the move; with nothing waiting it SHALL say "Nothing waiting." One click on a card SHALL choose it: the diary moves to that job's week, or for a change request into another week to the week the customer asked for (Jack, 15 Oct), shows Everyone, marks its block, and the card shows Open. Open, or a double-click, SHALL open the request. On a touch screen a second tap on the chosen card SHALL open it too (Workshop day decision 14); a second click with a mouse SHALL NOT.

#### Scenario: Choosing Sam Reed's request
- **WHEN** staff click Sam Reed's card, booked for 14 October
- **THEN** the diary shows "12–18 October 2026" and the Specialized Sirrus block is marked "chosen from Waiting for you"

#### Scenario: A card's words
- **WHEN** Sam Reed has asked for a Brake service on Friday 9 October, 10:00–10:45 (the Week view's example)
- **THEN** his card reads "New booking request", "Sam Reed" and "Brake service · Fri 9 Oct, 10:00–10:45"

#### Scenario: Double-click
- **WHEN** staff double-click Aisha Khan's cancellation card
- **THEN** its pop-up opens straight away

#### Scenario: A second tap on a tablet
- **WHEN** staff tap Aisha Khan's cancellation card on a tablet, then tap it again
- **THEN** the first tap chooses it and the second opens its pop-up

#### Scenario: A second click with a mouse
- **WHEN** staff click Aisha Khan's cancellation card with a mouse, then click it again
- **THEN** it stays chosen and its pop-up does not open
