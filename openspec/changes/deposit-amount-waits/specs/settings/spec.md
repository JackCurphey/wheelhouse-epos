# Spec Delta

## MODIFIED Requirements

### Requirement: The shop sets whether it takes a deposit when booking, and how much

Settings › Workshop › Online booking SHALL have the Deposits part drawn in
`bk-settings-deposits`: "Take a deposit when booking"; when on, "Deposit" (A
fixed amount or A percentage of the price), "How much", "If the price isn't
known" and "Free to cancel until" (hours before). The fold's summary SHALL
say the deposit or "no deposit". Deposits SHALL be off for every shop to
start, and SHALL only switch on while a payment provider is connected.

#### Scenario: Switched on before How much
- **WHEN** the Owner switches deposits on and hasn't filled in How much
- **THEN** deposits are on, no deposit is taken until it is filled in, and the fold says "no deposit"

#### Scenario: The fold says the deposit
- **WHEN** the shop takes 20%
- **THEN** the Online booking fold's summary includes "deposit 20%"

#### Scenario: Confirming by hand
- **WHEN** automatic confirming is off
- **THEN** the note "With automatic confirming off, the customer pays before the shop has said yes; if the shop declines, the deposit is refunded automatically." shows

#### Scenario: No payment provider
- **WHEN** no payment provider is connected and the Owner switches deposits on
- **THEN** it is refused, saying to connect one first, and deposits stay off

#### Scenario: Picking the kind and typing straight away
- **WHEN** the Owner picks "A fixed amount" and the answer hasn't come back yet
- **THEN** How much is greyed out until it comes back as the £ box, so what's typed is saved as pounds, never as a percentage
