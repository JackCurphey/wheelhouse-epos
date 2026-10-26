# Spec Delta

## ADDED Requirements

### Requirement: The shop's website never stops the server
When the server can't find the shop a website request names (the database is too busy to answer in time, or the shop's name in the address is one it can't look up), or can't read the address at all, it SHALL answer that request with an error and SHALL go on answering every other request, for every shop.

#### Scenario: a shop name the database refuses
- **WHEN** a request to the shop's website names a shop the database can't look up
- **THEN** that request gets an error answer
- **AND** the next request, from anyone, is answered as normal

### Requirement: Many customers can sign in by code at once
Signing a customer in by an emailed code SHALL make the customer's sign-in on the request's own database connection, so that many customers signing in at the same moment are all answered.

#### Scenario: 12 customers enter their codes at the same moment
- **WHEN** 12 customers of North Street Cycles each enter their correct emailed code at the same moment
- **THEN** every one is signed in well within the 5-second wait for a connection, and each sign-in opens that customer's own account
