## MODIFIED Requirements

### Requirement: Takings and cash-ups lists each closed day
Takings and cash-ups SHALL open on This week, with the same periods as Sales, and show Closed days' takings, Card, Cash, Other ("Gift cards, store credit and customer accounts"), Cycle to Work ("Owed by providers, not in the drawer"), Online ("Paid on the website · separate from the tills") and Cash differences, a graph of takings by closed day, and a table of days, newest first: Day, Takings, Cash banked, Cash difference, Closed by. Cycle to Work and Online SHALL be beside Closed days' takings, not in them (Jack, 14 Nov, merge-c2w Q1 option 2).

#### Scenario: the comparison while today is open
- **WHEN** Jack opens Takings and cash-ups on Thursday and Thursday isn't closed yet
- **THEN** each figure is compared with last Monday to Wednesday, not last Thursday's close against nothing

#### Scenario: a week with three closed days
- **WHEN** Jack opens Takings and cash-ups on Thursday and Monday to Wednesday were closed
- **THEN** the table has Thursday "Not closed yet", then Wednesday, Tuesday and Monday with their takings, cash banked, difference and who closed each

#### Scenario: a short day stands out
- **WHEN** a day's cash was short
- **THEN** its Cash difference shows with a minus sign, in the warning colour and in words for a screen reader

#### Scenario: Cycle to Work money beside the takings
- **WHEN** a closed day had a Cycle to Work hand-over
- **THEN** its provider share is in the Cycle to Work figure and not in Closed days' takings
