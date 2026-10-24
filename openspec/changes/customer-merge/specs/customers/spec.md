## ADDED Requirements

### Requirement: Possible duplicates are flagged, never merged by themselves

A customer's page SHALL say when another active customer has the same phone
number (however written) or email, unless staff have said they're different
people, and SHALL never merge them without staff choosing to.

#### Scenario: same phone
- **WHEN** Maya Patel and Maya P. both have 07700 900142
- **THEN** Maya Patel's page says "Might be the same person as Maya P. · same phone number" with Check

#### Scenario: different people
- **WHEN** staff press They're different people
- **THEN** neither page flags the other again

### Requirement: Merge into one, undoable for 30 days

Merge SHALL keep the chosen value of each field that differs, move every job,
sale, order, bike, message, till sale, group and online account of the other
record to this one, and hide the other record. For 30 days Undo the merge SHALL
put back everything that moved and the fields as they were; after 30 days the
hidden record SHALL be removed.

#### Scenario: merged
- **WHEN** staff merge Maya P. into Maya Patel, keeping Maya Patel's name
- **THEN** Maya P.'s jobs and sales are on Maya Patel's page and Maya P. is no longer listed or found

#### Scenario: undone
- **WHEN** staff undo the merge within 30 days
- **THEN** Maya P. is back with her own jobs and sales, and Maya Patel's fields are as they were

#### Scenario: both have online accounts
- **WHEN** both records have an online account
- **THEN** Merge is refused, saying so, and nothing moves
