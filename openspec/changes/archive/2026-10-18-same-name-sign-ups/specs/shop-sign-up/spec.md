## ADDED Requirements

### Requirement: Every shop gets its own web address, even when signing up at the same moment
A new shop SHALL be given a web address made from its name in lower case with hyphens between words; when that address is taken, it SHALL get the name followed by -2, then -3 and so on. Two shops with the same name signing up at the same moment SHALL both succeed, each with a different address.

#### Scenario: A second shop with a taken name
- **WHEN** a shop called "[shop name]" signs up and that name's address is already taken
- **THEN** the new shop's address is the name's address followed by -2

#### Scenario: Three shops with the same name at the same moment
- **WHEN** three shops with the same name sign up at the same moment
- **THEN** all three sign-ups succeed, with the name's address, then -2 and -3
