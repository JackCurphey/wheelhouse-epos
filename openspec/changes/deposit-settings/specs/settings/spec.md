## ADDED Requirements

### Requirement: The shop sets whether it takes a deposit when booking, and how much

Settings › Workshop › Online booking SHALL have the Deposits part drawn in
`bk-settings-deposits`: "Take a deposit when booking"; when on, "Deposit" (A
fixed amount or A percentage of the price), "How much", "If the price isn't
known" and "Free to cancel until" (hours before). The fold's summary SHALL
say the deposit or "no deposit". Deposits SHALL be off for every shop to
start, and SHALL only switch on while a payment provider is connected.

#### Scenario: The fold says the deposit
- **WHEN** the shop takes 20%
- **THEN** the Online booking fold's summary includes "deposit 20%"

#### Scenario: Confirming by hand
- **WHEN** automatic confirming is off
- **THEN** the note "With automatic confirming off, the customer pays before the shop has said yes; if the shop declines, the deposit is refunded automatically." shows

#### Scenario: No payment provider
- **WHEN** no payment provider is connected and the Owner switches deposits on
- **THEN** it is refused, saying to connect one first, and deposits stay off

### Requirement: A booking's deposit is worked out from the price shown

A booking's deposit SHALL be that percentage
of the price shown when booking, several services' shown prices added first
and a "from" price used as it stands, rounded to the nearest penny, and
never more than that price; a fixed amount is that amount, also never more
than the price; a booking whose price isn't known takes the "If the price
isn't known" amount, or no deposit when that is empty.

#### Scenario: A percentage of two services
- **WHEN** the shop takes 20% and a customer books a £65.00 service and a £12.50 one
- **THEN** the deposit is £15.50

#### Scenario: Rounded to the penny
- **WHEN** the shop takes 15% and the price shown is £33.33
- **THEN** the deposit is £5.00 (15% is £4.9995)

#### Scenario: Price not known
- **WHEN** a customer books "Not sure what's wrong?" and the shop's amount for that is £10
- **THEN** the deposit is £10.00; with no amount set, there's no deposit
