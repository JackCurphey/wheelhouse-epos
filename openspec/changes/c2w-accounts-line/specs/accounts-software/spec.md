## ADDED Requirements

### Requirement: Cycle to Work money has its own line
A Cycle to Work hand-over's provider share (paid as "Cycle to Work · [provider]") SHALL go in the day's summary to its own line, "Cycle to Work (owed by providers)", the same way online money has one, and not to Gift cards (Jack, 14 Nov, merge-c2w Q1 option 2). "Money taken goes to" SHALL list the line after Gift cards, with its own choice of account.

#### Scenario: A day with a Cycle to Work hand-over
- **WHEN** a closed day had a hand-over with the provider's share and £5.00 on a gift card
- **THEN** the summary's "Cycle to Work (owed by providers)" line holds the provider's share, Gift cards holds £5.00, and the summary balances

#### Scenario: The line in the account choices
- **WHEN** the owner opens "Which Xero account each line goes to"
- **THEN** "Money taken goes to" lists Cash, Card, Customer accounts, Gift cards, Cycle to Work (owed by providers), and Online sales (paid on the website)
