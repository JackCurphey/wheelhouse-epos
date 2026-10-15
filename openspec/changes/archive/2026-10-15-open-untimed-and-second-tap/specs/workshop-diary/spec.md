## MODIFIED Requirements

### Requirement: Jobs with no time sit in the No time row
A job with no start time SHALL NOT be drawn on the time grid. In the Week view on a computer or tablet it SHALL appear as a chip showing only the bike, in one "No time" row above the grid for the whole week; a click, a tap or Enter on the chip SHALL open the job's page, as a block does, and the chip SHALL NOT be moved. The Day view SHALL have the same row above its grid, with that day's untimed jobs only (Jack, 15 Oct). On a phone the row SHALL show the day's untimed jobs only when one column shows, and read "None" when there are none; its chips open the job in the same way.

#### Scenario: An untimed job
- **WHEN** [customer name]'s [bike] is booked for a Standard service on Tuesday with no time
- **THEN** "[bike]" sits in the Week view's No time row

#### Scenario: An untimed job in the Day view
- **WHEN** staff open the Day view for Tuesday
- **THEN** "[bike]" sits in its No time row, and a Wednesday job with no time does not

#### Scenario: Opening an untimed job
- **WHEN** staff click, or press Enter on, the No time chip for [bike]
- **THEN** that job's page opens

### Requirement: The diary's Waiting column chooses and opens what is waiting
On a computer or tablet the diary SHALL show "Waiting for you ([n])" beside the grid, refreshed every minute, one card per item with its kind, the customer, and the services and time or the move; with nothing waiting it SHALL say "Nothing waiting." One click on a card SHALL choose it: the diary moves to that job's week, shows Everyone, marks its block, and the card shows Open. Open, or a double-click, SHALL open the request. On a touch screen a second tap on the chosen card SHALL open it too (Workshop day decision 14); a second click with a mouse SHALL NOT.

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
