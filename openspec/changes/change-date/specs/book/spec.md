## ADDED Requirements

### Requirement: The customer can ask for a new date from the booking page
While a confirmed booking can still be changed online, its page SHALL offer "Change the date", showing the days and times its mechanic could take it, its own slot included; asking for a new date SHALL leave the booking as it is until the shop confirms (Jack, 1 Oct, decision 10; 19 and 20 Oct).

#### Scenario: Asking for Friday
- **WHEN** Maya picks Friday 25 September at 14:00 and presses Ask for this date
- **THEN** her page says "New date waiting for the shop" and her booking stays on Thursday until the shop confirms

#### Scenario: Taking it back
- **WHEN** she presses Cancel my date change
- **THEN** her booking is confirmed for Thursday, as before

#### Scenario: The shop can't do it
- **WHEN** the shop declines the new date
- **THEN** her page says the shop couldn't do the new date, and her booking is still Thursday
