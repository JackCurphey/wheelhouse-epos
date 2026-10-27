# Spec Delta

## ADDED Requirements

### Requirement: A short float goes to Needs attention until Seen
A float counted short SHALL be on the Owner's Needs attention, whatever day it was counted, until Seen: "The float was [£] short this morning" for today's, "The float was [£] short on [date]" for an earlier day's, "Counted by [Name] at [time]", with "“[their reason]”" when one was given, and a "Seen" button (opening the shop decisions 4 and 8, audit H3; `op-today-short`).

#### Scenario: Jack sees a short float
- **WHEN** Jo Taylor counted the float short this morning and Jack Lewis, the Owner, opens Today
- **THEN** Needs attention says the float was short, by how much, who counted it and when, with Seen

#### Scenario: Nobody saw it yesterday
- **WHEN** yesterday's float was counted short and nobody pressed Seen
- **THEN** today Needs attention still lists it, with yesterday's date

### Requirement: Seen clears a short float, for the Owner
"Seen" SHALL take a short float off Needs attention in one click and record who and when (`op-today-seen`). Only the Owner SHALL see it or press Seen, until roles.

#### Scenario: Seen
- **WHEN** Jack Lewis presses Seen
- **THEN** the line goes and stays gone

### Requirement: An over float waits for Close the day
An over float SHALL not be listed on Needs attention until Close the day exists (decision 8 H1: over goes only when yesterday was closed).

#### Scenario: Over this morning
- **WHEN** Jo Taylor counted the float over this morning
- **THEN** Needs attention doesn't list it
