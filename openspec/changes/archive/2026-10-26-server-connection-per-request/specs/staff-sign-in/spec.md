# Spec Delta

## ADDED Requirements

### Requirement: A signed-in request is looked up once
The server SHALL look up who is signed in once per staff request, before it takes that request's database connection, and every later "who is signed in?" check in the same request (such as the Owner-only check) SHALL use that answer without taking a second connection.

#### Scenario: an owner saves settings on several screens at once
- **WHEN** a shop's owner sends 12 Owner-only requests at the same moment
- **THEN** every one is answered (not refused for being busy) well within the 5-second wait for a connection

#### Scenario: a staff member is still refused
- **WHEN** a signed-in staff member who is not the Owner sends an Owner-only request
- **THEN** it is refused as before, with the same answer
