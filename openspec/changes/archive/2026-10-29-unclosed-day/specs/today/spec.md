## ADDED Requirements

### Requirement: A day nobody closed goes to Needs attention with Close it
For the Owner, Needs attention SHALL list each day nobody closed that has a count waiting: "Wednesday 16 September wasn't closed", "Till B1 · counted with this morning's float by Jo Taylor · still to bank", and Close it, which opens that day's Close the day (`op-today-unclosed`, `op-today-two`; opening the shop decision 7). The line SHALL go once the day is closed. A short float SHALL still be listed beside it.

#### Scenario: Wednesday wasn't closed
- **WHEN** Jo Taylor counted Wednesday's cash with this morning's float
- **THEN** Today says Wednesday wasn't closed, with Close it

#### Scenario: Two things to deal with
- **WHEN** this morning's count was also short
- **THEN** Needs attention lists the short float with Seen and Wednesday with Close it
