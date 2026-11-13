## ADDED Requirements

### Requirement: Online orders join the customer's account
A guest's order SHALL be kept with the email they typed, and SHALL show in their account once they sign in with that email by code, each opening the same order page as the private link. Typed details alone SHALL never attach an order to an existing customer. A signed-in customer SHALL only ever see their own orders.

#### Scenario: A guest order, then signing in
- **WHEN** Maya ordered as a guest with maya@example.test and later signs in with that email
- **THEN** the order is in her account

#### Scenario: Someone else's order
- **WHEN** a signed-in customer asks for an order that isn't theirs
- **THEN** they get the same answer as for an order that doesn't exist

### Requirement: Saving details after an order uses the emailed code
"Save my details" on the confirmation SHALL send the customer's sign-in code to the order's email; the right code SHALL sign them in and join the order to their account, with no password step.

#### Scenario: A wrong code
- **WHEN** Maya types a code that isn't the one sent
- **THEN** she isn't signed in and is told, as at the account's own sign-in
