# Spec Delta

## ADDED Requirements

### Requirement: The account page
A signed-in customer SHALL have an account page at their shop, "Your account", showing their name and email with Sign out, their bikes with any repair in now, their details and how the shop contacts them, and their history. Signed out, the page SHALL send the customer to sign in and back.

#### Scenario: Maya's account
- **WHEN** Maya, signed in, opens her account with her Trek in the shop
- **THEN** she sees "Your account" and her Trek with "In the shop now · WH-1042"

#### Scenario: someone new
- **WHEN** a customer with no bikes and no history opens their account
- **THEN** they see "No bikes yet. Add one to book it in faster." and "Nothing here yet. Your repairs and purchases with North Street Cycles show here."

#### Scenario: signed out
- **WHEN** someone not signed in opens the account
- **THEN** they are taken to sign in, and back to the account after

### Requirement: The account's history
The account's history SHALL list the customer's repairs and purchases, filtered by Everything, Repairs or Purchases, with what's open now first and the rest newest first, eight at a time. A repair SHALL open its own page.

#### Scenario: a repair in the shop
- **WHEN** Maya's repair is in the shop
- **THEN** it is under Now, and choosing it opens its page
