# Spec Delta

## MODIFIED Requirements

### Requirement: Tills shows whether the till is open, for the Owner
For the Owner, Today SHALL show a Tills card with one line per till, headed "Till [code]" (`op-today`), and one headed "Till" for a computer that isn't a set-up till when no till is set up or one was used today: "Open · float checked by [Name] at [time]" on the till the float was checked at, "Open · [Name] checked in at [time]" from that till's first check-in otherwise, or "Not open yet"; with "Float short" while a short float waits to be Seen, and "Float short · seen by [Name]" after (`op-today-short`, `op-today-seen`). The server SHALL refuse it to anyone else, until roles.

#### Scenario: The float was checked
- **WHEN** Jo Taylor checked the float on Till B1 this morning and Jack Lewis opens Today
- **THEN** Tills reads "Till B1" and "Open · float checked by Jo Taylor at [time]"

#### Scenario: Staff
- **WHEN** Jo Taylor opens Today
- **THEN** she sees no Tills card, and the server refuses her its lines

### Requirement: A short float goes to Needs attention until Seen
A float counted short SHALL be on the Owner's Needs attention, whatever day it was counted, until Seen: "Till [code]’s float was [£] short this morning" when it was counted on a set-up till, "The float was [£] short this morning" otherwise, with "on [date]" in place of "this morning" for an earlier day's, "Counted by [Name] at [time]", with "“[their reason]”" when one was given, and a "Seen" button (opening the shop decisions 4 and 8, audit H3; `op-today-short`).

#### Scenario: Jack sees a short float
- **WHEN** Jo Taylor counted the float short on Till B1 this morning and Jack Lewis, the Owner, opens Today
- **THEN** Needs attention says "Till B1’s float was [£] short this morning", who counted it and when, with Seen

#### Scenario: Nobody saw it yesterday
- **WHEN** yesterday's float was counted short and nobody pressed Seen
- **THEN** today Needs attention still lists it, with yesterday's date
