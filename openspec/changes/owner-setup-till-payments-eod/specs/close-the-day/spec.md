# Spec Delta

## MODIFIED Requirements

### Requirement: Close the day appears on the till after closing time
For the Owner, the till SHALL show "Close the day" from the time the shop chose in Settings › End of day › Close the day (at closing time, 30 minutes before or 1 hour before today's closing time; cash-up decision 5; owner setup decision 18; `set-eod-close`, `eod-entry`). It SHALL show all day when the opening hours say the shop is shut today, and not once the day is closed. Nobody else SHALL see it until roles.

#### Scenario: An hour before closing
- **WHEN** the shop closes at 17:30, the shop chose 1 hour before, and Jack Lewis, the Owner, is on the till at 16:45
- **THEN** the till shows "Close the day"

#### Scenario: Thirty minutes before closing
- **WHEN** the shop closes at 17:30, the shop chose 30 minutes before, and Jack Lewis, the Owner, is on the till at 17:00
- **THEN** the till shows "Close the day"

#### Scenario: Before the chosen time
- **WHEN** the shop chose 30 minutes before and the till is open at 16:45
- **THEN** the till doesn't show it

#### Scenario: At closing time
- **WHEN** the shop chose At closing time and it is 17:30
- **THEN** the till shows "Close the day"

#### Scenario: During the day
- **WHEN** it is 11:00 on the same day
- **THEN** the till doesn't show it

### Requirement: The cash is counted blind
When the shop has Count first on (Settings › End of day › Counting the cash), "Count the cash" SHALL open with the note-and-coin counter and "Done counting — show the difference", and SHALL not show what the till expects until the count is done (cash-up decisions 2 and 3; `eod-count`). When Count first is off, the counter SHALL show the expected amount and the difference as the count changes, and the step SHALL move on with "Done counting". The figures saved at the close SHALL be the same either way.

#### Scenario: Counting
- **WHEN** Count first is on and Jack Lewis opens Close the day
- **THEN** he sees a box for each note and coin and the total, and no expected figure

#### Scenario: Counting with the expected amount shown
- **WHEN** Count first is off and Jack opens Close the day
- **THEN** he sees “The till expects” and the amount in a row above the note-and-coin counter while he counts (eod-count-shown), and the difference changes as he types
