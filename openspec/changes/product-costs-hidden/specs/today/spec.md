## ADDED Requirements

### Requirement: A big adjustment's value follows the person
A stock adjusted line in Needs attention SHALL send its value at cost only to someone who can see costs; the line itself SHALL still show for anyone allowed to see Needs attention.

#### Scenario: Jo Taylor at the Owner's till
- **WHEN** Jo Taylor opens Today on a till signed in as the Owner, with a big adjustment to see
- **THEN** the line shows its product and change, and no value at cost is on the page or in what the server sent
