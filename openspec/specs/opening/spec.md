# opening Specification

## Purpose
TBD - created by archiving change opening-float-check. Update Purpose after archive.

## Requirements

### Requirement: The first person in who takes payments checks the float
When the shop has a float set and nobody has checked it today, the first person to check in at the till with their PIN that day who takes payments (the Owner, or a team member marked as a cashier) SHALL be asked "Hello, [first name]" and shown "The drawer should have [£ float]", "The shop's float", with "Count it" and "Looks right" as the only ways out: no ✕ (opening the shop decision 2; audit M1; `op-float-check`; Jack's answer 3 of 27 Oct: it moves to the check-in when PIN check-in lands). The check SHALL be recorded under the person checked in.

#### Scenario: First in
- **WHEN** Jo Taylor, a cashier, checks in at the till first today and the shop's float is set
- **THEN** she sees "Hello, Jo" and "The drawer should have [£ float]", with Count it and Looks right

#### Scenario: Not checked in
- **WHEN** nobody has checked in on the till
- **THEN** the till shows Enter your PIN, and the float check waits for the check-in

### Requirement: Who isn't asked
Someone who doesn't take payments SHALL not be asked. A shop with no float set SHALL not be asked. Once the float has been checked, nobody else SHALL be asked that day.

#### Scenario: Second in
- **WHEN** Jo Taylor has checked the float and Jack Lewis opens the till
- **THEN** Jack Lewis isn't asked

#### Scenario: No float set
- **WHEN** the shop has no float set and Jo Taylor opens the till
- **THEN** she isn't asked

### Requirement: Looks right starts the day
"Looks right" SHALL record that the float looked right, by whom and when, close the pop-up and say "Float checked · looked right · [Name]" (written line on `op-float-check`, `consolidate/j10.mjs:31`).

#### Scenario: A quick look
- **WHEN** Jo Taylor presses Looks right
- **THEN** the till is ready and says "Float checked · looked right · Jo Taylor"

### Requirement: The first day on Wheelhouse is counted
When nothing has ever been counted in Wheelhouse for the shop, the float check SHALL say "first in on the first day on Wheelhouse", explain that the float is counted once so today starts from a real figure, and offer "Count it" only (UX walk-through 4 M4; `op-float-check-first`). The server SHALL refuse "looked right" that day.

#### Scenario: The first real morning
- **WHEN** Jo Taylor opens the till on the shop's first day on Wheelhouse
- **THEN** she can only count the float

### Requirement: Count it counts note by note
"Count it" SHALL open "Count the float", "count every note and coin", with the note-and-coin counter, never showing what the drawer should have (blind counting, cash-up decision 2), "Back" to the float check, and "Done counting", off until something is counted (`op-float-count`; audit H1).

#### Scenario: Nothing counted yet
- **WHEN** Jo Taylor opens the count and hasn't typed anything
- **THEN** Done counting is off

### Requirement: A count that matches starts the day
A count equal to the float SHALL be recorded, by whom and when, close the pop-up and say "Float checked · counted by [Name]" (`op-float-matched`).

#### Scenario: The drawer is right
- **WHEN** Jo Taylor counts exactly the shop's float and presses Done counting
- **THEN** the till is ready and says "Float checked · counted by Jo Taylor"

### Requirement: A count that doesn't match says so
A count below or above the float SHALL show "The float is short" or "The float is over", "counted by [Name]", Should have, Counted and the Difference ("[£] short" or "[£] over"), an optional "Any idea why?", and "A manager sees this on Today. The till starts with what you counted." The ways out SHALL be "Count again", back to the count, and "Start the day", which records the count and the reason; no ✕ (`op-float-short`, `op-float-over`; audit H1, walk-through 2 L3).

#### Scenario: Short
- **WHEN** Jo Taylor counts less than the float and presses Done counting
- **THEN** she sees "The float is short" with the difference, and Start the day records her count and reason

### Requirement: One float check a day, kept per shop
The server SHALL keep at most one float check per shop per day (the shop's own date), with what the drawer should have had, what was counted (none for "looked right"), the reason, who, when, and the till it was checked at; a second check that day SHALL be refused with the first one returned, on any till. Amounts SHALL be whole pence. Each shop SHALL see only its own float checks. The float check's pop-ups SHALL name the till ("Till B1 · first in today to take payments", "Float checked · Till B1 · counted by Jo Taylor") on a set-up till (`op-float-check`, `op-float-matched`).

#### Scenario: Two at once
- **WHEN** two people send a float check for the same shop at the same moment
- **THEN** one is kept and the other is told the float was already checked

#### Scenario: Two tills
- **WHEN** Jo Taylor checked the float on Till B1 and Alex Morgan checks in on Till B2
- **THEN** Alex Morgan isn't asked: the shop's float was checked today
