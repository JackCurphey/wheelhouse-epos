# Spec Delta

## ADDED Requirements

### Requirement: A customer's request is looked up once
The server SHALL look up a customer's sign-in once per request to the shop's website, before it takes that request's database connection, and only when the request carries a sign-in cookie. Every later "who is signed in?" check in the same request SHALL use that answer without taking a second connection. A customer signed in to one shop SHALL still get nothing from another shop.

#### Scenario: many customers check their account at once
- **WHEN** 12 requests for a customer's own account arrive at the same moment, whether signed in or carrying a cookie that matches no sign-in
- **THEN** every one is answered (signed in, or "Not signed in") well within the 5-second wait for a connection

#### Scenario: a customer of one shop asks another
- **WHEN** a customer signed in to North Street Cycles asks Elsewhere Cycles for their account, bikes, bookings, history or a repair by `job-<id>`
- **THEN** they are refused as not signed in (or "We can't find that booking"), as before
