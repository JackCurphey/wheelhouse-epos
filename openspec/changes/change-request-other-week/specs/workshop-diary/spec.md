## MODIFIED Requirements

### Requirement: A customer's change request shows where the customer wants to go
A booking with a customer's change request waiting SHALL show amber at its current time, and a dashed outline reading "Requested [time]" at the time the customer asked for, when that time falls in a day and column on screen, also in a week where the booking itself is not (Jack, 15 Oct). A screen reader SHALL hear "[bike] asks to move here: [time]", or "[customer] asks to move here: [time]" in a week without the booking. The outline of a request chosen from "Waiting for you" SHALL take the strong mark a chosen block has; when it is on screen, the booking's own block SHALL take only a light grey ring (the drawing's change-selected).

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

### Requirement: On a phone the diary is one day at a time
Below tablet width the diary SHALL show one day, chosen from a strip of the week's seven days in place of the Week and Day switch, with arrows that move a week and keep the weekday. One people chip SHALL choose Everyone (one column), By mechanic (a column each) or one person. "Waiting" with its count SHALL sit in the top bar and open the list as a sheet; choosing a card SHALL go to its day, or for a change request into another week to the day asked for (Jack, 15 Oct).

#### Scenario: A phone opens on Tuesday
- **WHEN** staff open the diary on a phone on Tuesday 6 October
- **THEN** seven day tabs show with Tuesday chosen, Tuesday's jobs show, Monday's do not, and there is no Week tab

#### Scenario: The week arrows
- **WHEN** staff press Next week on Tuesday 6 October
- **THEN** the label reads "12–18 Oct" and Tuesday 13 October is chosen

#### Scenario: By mechanic
- **WHEN** staff open the people chip and choose By mechanic
- **THEN** Alex Morgan and Jo Taylor each get a column

#### Scenario: A waiting card on a phone
- **WHEN** staff open Waiting and choose the card for a booking request on Thursday 8 October
- **THEN** the diary goes to Thursday 8 October with a bar at the bottom showing the customer and Open, and Open shows the request

#### Scenario: A change request into another week on a phone
- **WHEN** Oliver Chen's Brompton C Line is booked on Tuesday 6 October, he asks for 14:00 on Tuesday 13 October, and staff choose his card
- **THEN** Tuesday 13 October is chosen and shows "Requested 14:00"
