# Spec Delta

## ADDED Requirements

### Requirement: One request that can't be looked up never stops the server
When the server can't look up who is signed in on a staff request (the database is too busy to answer in time, or the request carries a sign-in cookie it can't read), it SHALL answer that request with an error and SHALL go on answering every other request, for every shop.

#### Scenario: a sign-in cookie the database refuses
- **WHEN** a staff request arrives with a sign-in cookie the database can't look up, or one that can't be read at all
- **THEN** that request gets an error answer
- **AND** the next request, from anyone, is answered as normal
