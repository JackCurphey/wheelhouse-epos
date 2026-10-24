## ADDED Requirements

### Requirement: The customer's quote names staff only when the shop shows who signed off
The quote on the customer's booking link SHALL follow its drawings (journey 4). It SHALL name the mechanic, and who took an answer by phone or in the shop, only when the shop's "Show who signed off to customers" switch is on; otherwise it SHALL say "we" (Jack, 22 Oct). It SHALL thank the customer by first name, and offer the shop's phone for anyone not sure.

#### Scenario: Switch on
- **WHEN** Alex Morgan's quote is sent to Maya Patel and the shop's switch is on
- **THEN** the card says "Alex recommends more work", and once Maya answers, "Thanks, Maya — Alex is carrying on"

#### Scenario: Switch off
- **WHEN** the same quote is sent with the switch off
- **THEN** the card says "We recommend more work", and once Maya answers, "Thanks, Maya — we’re carrying on", and the reply carries no staff names

#### Scenario: Answered by phone
- **WHEN** Jo Taylor records Maya's answer by phone and the switch is off
- **THEN** Maya's page says "Your answers, from your call" and "You answered by phone at [time]. Here’s what was agreed.", without Jo's name

#### Scenario: Withdrawn
- **WHEN** the shop withdraws the quote with the switch off
- **THEN** the card says "We’ve withdrawn this quote" and "Nothing to answer. Call [shop phone] if you have a question."
