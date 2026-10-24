## ADDED Requirements

### Requirement: The deposit comes back when the booking is cancelled in time or the shop can't fit it in

A booking's deposit SHALL be refunded automatically when the customer cancels
before the time it is free to cancel until, and when the shop declines it,
lets the request expire, or cancels it. Cancelled after that time, the
deposit SHALL be kept, and the cancel SHALL be refused unless the customer
chose to lose the deposit. A refund the provider can't make at once SHALL be
made later, never lost.

#### Scenario: Cancelled in time
- **WHEN** Maya cancels two days before her booking, before Free to cancel until
- **THEN** her £13.00 is refunded to her card

#### Scenario: Cancelled late
- **WHEN** Maya cancels after Free to cancel until and chose Cancel and lose the deposit
- **THEN** the booking is cancelled and the £13.00 is kept

#### Scenario: Late, without choosing to lose it
- **WHEN** a page opened before the cut-off sends a cancel after it
- **THEN** it is refused, saying the deposit would be kept, and nothing changes

#### Scenario: The shop declines
- **WHEN** the shop declines Maya's request
- **THEN** her £13.00 is refunded automatically
