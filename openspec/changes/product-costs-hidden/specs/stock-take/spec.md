## ADDED Requirements

### Requirement: A count's value at cost follows the person
A count's values at cost, on its check, in its download, in what Apply answers and on Finished counts, SHALL be sent only to someone who can see costs. The rest of the check and the download SHALL stay the same for anyone else allowed to open them.

#### Scenario: Jo Taylor checks a count at the Owner's till
- **WHEN** Jo Taylor opens a count's check on a till signed in as the Owner
- **THEN** she sees how many differ and by how many, and no value at cost is on the page or in what the server sent
- **AND** the differences are listed by size, then name, not by value, so their order doesn't say which product costs more
