# Spec Delta

## ADDED Requirements

### Requirement: One request that can't be looked up never stops the server
When the server can't look up who is signed in on a staff request (the database is too busy to answer in time, or refuses the sign-in cookie), it SHALL answer that request with "Internal server error", without the database's own words, and SHALL go on answering every other request, for every shop.

#### Scenario: a sign-in cookie the database refuses
- **WHEN** a staff request arrives with a sign-in cookie the database can't look up
- **THEN** that request gets "Internal server error"
- **AND** the next request, from anyone, is answered as normal

### Requirement: Another app's cookie never stops a signed-in request
A cookie the server can't read (such as `promo=50%off`, set by another app on the same domain) SHALL be kept as it is, and SHALL NOT stop a request that is otherwise signed in.

#### Scenario: a signed-in owner with another app's cookie
- **WHEN** the Owner, signed in, opens a screen while their browser also carries `promo=50%off`
- **THEN** the screen is answered as normal
