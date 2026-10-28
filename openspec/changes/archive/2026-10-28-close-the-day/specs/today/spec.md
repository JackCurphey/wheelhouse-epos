# Spec Delta

## REMOVED Requirements

### Requirement: An over float waits for Close the day
**Reason**: Close the day now exists, so an over float is listed when yesterday was closed (below).
**Migration**: None; nothing was listed before.

## ADDED Requirements

### Requirement: An over float goes to Needs attention when yesterday was closed
A float counted over SHALL be on the Owner's Needs attention until Seen, but only when the shop's previous day (the last day the till opened) was closed: "The float was [£] over this morning", or "on [date]" for an earlier day, "Counted by [Name] at [time]", the reason when one was given, and "Seen" (opening the shop decision 8 H1; the short float's line, `op-today-short`). When the previous day wasn't closed, or there is none, it SHALL not be listed.

#### Scenario: Over after a closed day
- **WHEN** yesterday was closed and Jo Taylor counted the float over this morning
- **THEN** Needs attention says the float was over, by how much, with Seen

#### Scenario: Over after a day nobody closed
- **WHEN** yesterday wasn't closed and the float is over this morning
- **THEN** Needs attention doesn't list it
