# Spec Delta

## MODIFIED Requirements

### Requirement: Customers sign in with a code sent by email
A customer SHALL be able to sign in to a shop with a six-digit code emailed to them, valid for 10 minutes and used once. A wrong code SHALL say so; an expired one SHALL say "That code has expired — send a new one". Asking for a code SHALL answer the same whether the email has an account or not. Asking and checking SHALL be limited per network and per email.

#### Scenario: Maya signs in
- **WHEN** Maya asks for a code at North Street Cycles and types the one emailed to her
- **THEN** she is signed in to North Street Cycles

#### Scenario: an old code
- **WHEN** a code more than 10 minutes old is typed
- **THEN** sign-in is refused with "That code has expired — send a new one"

#### Scenario: not switched on
- **WHEN** no sign-in provider is connected
- **THEN** asking for a code says "Signing in by email isn’t switched on yet"

## ADDED Requirements

### Requirement: A first code sign-in joins the one customer the shop already has
The first sign-in by code with an email SHALL join the customer the shop already has with that email, ignoring case and spaces, when there is exactly one such active customer, that customer has no online account, and the email is one the customer gave themselves (at an online booking or sign-up, and not changed by staff since). Otherwise it SHALL make a new customer and login. Sign-up with a password SHALL never join an existing customer.

#### Scenario: Maya booked as a guest
- **WHEN** Maya, who booked a repair as a guest with maya@example.test, signs in with a code sent to that email for the first time
- **THEN** she is signed in as the customer who booked that repair

#### Scenario: an email staff typed in
- **WHEN** staff saved a customer with an email, and someone signs in with a code sent to that email
- **THEN** a new customer is made, for staff to join with Merge

#### Scenario: two customers share the email
- **WHEN** two of the shop's customers have the email and someone signs in with a code sent to it
- **THEN** a new customer is made, for staff to join with Merge

### Requirement: Signed-in customers open their own repairs
A signed-in customer SHALL be able to open the page of any repair of theirs at that shop from their account, with everything the private link's page offers, after the link's 30 days too. Opening a repair that isn't theirs, or without signing in, SHALL answer as an unknown link does.

#### Scenario: another customer's repair
- **WHEN** a signed-in customer asks for a repair that belongs to someone else
- **THEN** they are told it can't be found

### Requirement: Signed-in customers see their history
A signed-in customer SHALL be able to see their repairs, each with its stage and total, and their purchases, with what was bought and the total, newest first.

#### Scenario: a repair and a till sale
- **WHEN** Maya has a repair in the shop and bought something at the till
- **THEN** her history lists both, newest first
