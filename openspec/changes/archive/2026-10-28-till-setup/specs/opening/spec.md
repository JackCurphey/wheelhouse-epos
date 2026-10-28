# Spec Delta

## MODIFIED Requirements

### Requirement: One float check a day, kept per shop
The server SHALL keep at most one float check per shop per day (the shop's own date), with what the drawer should have had, what was counted (none for "looked right"), the reason, who, when, and the till it was checked at; a second check that day SHALL be refused with the first one returned, on any till. Amounts SHALL be whole pence. Each shop SHALL see only its own float checks. The float check's pop-ups SHALL name the till ("Till B1 · first in today to take payments", "Float checked · Till B1 · counted by Jo Taylor") on a set-up till (`op-float-check`, `op-float-matched`).

#### Scenario: Two at once
- **WHEN** two people send a float check for the same shop at the same moment
- **THEN** one is kept and the other is told the float was already checked

#### Scenario: Two tills
- **WHEN** Jo Taylor checked the float on Till B1 and Alex Morgan checks in on Till B2
- **THEN** Alex Morgan isn't asked: the shop's float was checked today
