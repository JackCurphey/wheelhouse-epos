## ADDED Requirements

### Requirement: Cycle to Work money has its own line
A Cycle to Work hand-over's provider share (paid as "Cycle to Work · [provider]") SHALL go in the day's summary to its own line, "Cycle to Work (owed by providers)", the same way online money has one, and not to Gift cards (Jack, 14 Nov, merge-c2w Q1 option 2). "Money taken goes to" SHALL list the line after Gift cards, with its own choice of account.

#### Scenario: A day with a Cycle to Work hand-over
- **WHEN** a closed day had a hand-over with the provider's share and £5.00 on a gift card
- **THEN** the summary's "Cycle to Work (owed by providers)" line holds the provider's share, Gift cards holds £5.00, and the summary balances

#### Scenario: A till payment called Cycle to Work
- **WHEN** a till-record sale was paid with a method called "Cycle to Work · Cyclescheme"
- **THEN** the summary files it under Gift cards, as close-the-day counts it under Other, because hand-overs are saved only in the old record

#### Scenario: No account chosen for the line
- **WHEN** a connected shop has no account chosen for "Cycle to Work (owed by providers)" and closes a day with Cycle to Work money
- **THEN** the day is not sent, saying "Cycle to Work (owed by providers) has no Xero account chosen", and choosing the account sends it

#### Scenario: The line in the account choices
- **WHEN** the owner opens "Which Xero account each line goes to"
- **THEN** "Money taken goes to" lists Cash, Card, Customer accounts, Gift cards, Cycle to Work (owed by providers), and Online sales (paid on the website)
