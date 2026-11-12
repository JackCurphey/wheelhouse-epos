# Spec Delta

## ADDED Requirements

### Requirement: Reopen this day
A closed day's report SHALL have "Reopen this day" for the Owner, until roles. It SHALL ask "Why are you reopening it? (needed)" with a box, say "Saved with your name and the time. The day goes back to Needs attention, and what was sent to Xero is corrected when it's closed again.", and offer "Keep it closed" and "Reopen the day", which SHALL stay off until a reason is typed. Only the latest closed day SHALL offer it. The reason, the person and the time SHALL be saved with the day, and the first close SHALL be kept.

#### Scenario: reopening Wednesday
- **WHEN** Jack opens Wednesday 16 September's report, chooses Reopen this day, types "a card payment was counted as cash" and chooses Reopen the day
- **THEN** the day is reopened, with his name, the time and his reason saved, and its report no longer counts it

#### Scenario: no reason
- **WHEN** the reason box is empty
- **THEN** "Reopen the day" is off

#### Scenario: an earlier day
- **WHEN** Tuesday's report is opened while Wednesday is closed
- **THEN** it has no Reopen this day

### Requirement: A reopened day is left out and said so
A reopened day's figures SHALL be left out of every report until it is closed again. Takings and cash-ups SHALL say so above its table: "Wed 16 Sep is reopened — its figures are left out until it's closed again" with "Close the day", and the Closed days' figures SHALL not add it.

#### Scenario: the reopened bar
- **WHEN** Wednesday is reopened and Jack opens Takings and cash-ups
- **THEN** the bar says Wednesday is reopened and left out, with "Close the day", and the headline figures are without Wednesday

### Requirement: The Sent to Xero column
While accounts software is connected or has been lost, the closed days table SHALL have a "Sent to Xero" column: Sent for a day sent, Not closed yet for today, Reopened for a reopened day, Not sent for a day that couldn't go, and Waiting for a day waiting to be sent. Without accounts software the column SHALL not be shown. The Online rows SHALL show the same as the day they belong to.

#### Scenario: a mixed week
- **WHEN** Monday and Tuesday were sent, Wednesday couldn't go and Thursday is open
- **THEN** the column reads Sent, Sent, Not sent and Not closed yet

#### Scenario: no accounts software
- **WHEN** the shop has never connected accounts software
- **THEN** the table has no Sent to Xero column
