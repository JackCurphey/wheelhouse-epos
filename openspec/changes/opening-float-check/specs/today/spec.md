# Spec Delta

## ADDED Requirements

### Requirement: A short float goes to Needs attention until Seen
A float counted short today SHALL be on the Owner's Needs attention as "The float was [£] short this morning", "Counted by [Name] at [time]", with "“[their reason]”" when one was given, and a "Seen" button (opening the shop decisions 4 and 8, audit H3; `op-today-short`). "Seen" SHALL take it off in one click and record who and when (`op-today-seen`). Only the Owner SHALL see it or press Seen, until roles. An over float SHALL not be listed until Close the day exists (decision 8 H1: over goes only when yesterday was closed). A short float from an earlier day SHALL not be listed.

#### Scenario: Jack sees a short float
- **WHEN** Jo Taylor counted the float short this morning and Jack Lewis, the Owner, opens Today
- **THEN** Needs attention says the float was short, by how much, who counted it and when, with Seen

#### Scenario: Seen
- **WHEN** Jack Lewis presses Seen
- **THEN** the line goes and stays gone
