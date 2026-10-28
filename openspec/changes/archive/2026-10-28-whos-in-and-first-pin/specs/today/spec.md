# Spec Delta

## ADDED Requirements

### Requirement: Who's in shows who checked in today, and who's due
Today SHALL show a Who's in card listing everyone who checked in at the till with their PIN today, "Checked in at [time] · [Owner, Mechanic or Staff]" with "In", first in first; then each mechanic due today who hasn't checked in, "Due in at [start time] · Mechanic" with "Not in yet", which SHALL read "Late" once the start time has passed (opening the shop decisions 3, 5 and 6; `op-today`, `op-today-late`). Nothing SHALL go to Needs attention for someone late. Who's in SHALL never carry a PIN.

#### Scenario: Jo has checked in
- **WHEN** Jo Taylor checked in at the till this morning
- **THEN** Who's in lists Jo Taylor, "Checked in at [time] · Staff", "In"

#### Scenario: Alex is due and hasn't come
- **WHEN** Alex Morgan works today from [start time] and hasn't checked in, and that time has passed
- **THEN** Who's in lists Alex Morgan, "Due in at [start time] · Mechanic", "Late"

#### Scenario: A mechanic off today
- **WHEN** a mechanic doesn't work today, or has the day off
- **THEN** Who's in doesn't list them until they check in

### Requirement: Tills shows whether the till is open, for the Owner
For the Owner, Today SHALL show a Tills card with one line for the shop's till, without a till name until tills have names: "Open · float checked by [Name] at [time]" once the float is checked, "Open · [Name] checked in at [time]" before that, or "Not open yet"; with "Float short" while a short float waits to be Seen, and "Float short · seen by [Name]" after (`op-today`, `op-today-short`, `op-today-seen`). The server SHALL refuse it to anyone else, until roles.

#### Scenario: The float was checked
- **WHEN** Jo Taylor checked the float this morning and Jack Lewis opens Today
- **THEN** Tills reads "Open · float checked by Jo Taylor at [time]"

#### Scenario: Staff
- **WHEN** Jo Taylor opens Today
- **THEN** she sees no Tills card, and the server refuses her its line

## MODIFIED Requirements

### Requirement: Staff see the workshop's day only

Someone who isn't the Owner SHALL see Who's in and Workshop today but not Needs attention or Tills, and the server SHALL refuse them the lists behind those, until roles let Managers and those who can close the day see them too (opening the shop decision 4; `op-today-staff`).

#### Scenario: Jo Taylor opens Today

- **WHEN** Jo Taylor, who isn't the Owner, opens Today
- **THEN** she sees Who's in and Workshop today, and no Needs attention or Tills card
