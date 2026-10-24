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

#### Scenario: removed after 30 days, with anything that arrived late
- **WHEN** 30 days have gone and a till sale synced late still names Maya P.
- **THEN** the sale moves to Maya Patel and Maya P. is removed

#### Scenario: undo after a later merge
- **WHEN** Maya Patel has since been merged into another record
- **THEN** undoing the first merge is refused, saying to undo the later one first

#### Scenario: a later merge into the same record
- **WHEN** Maya Patel has had a second record merged in since
- **THEN** undoing the first merge is refused until the second is undone

#### Scenario: a change made since
- **WHEN** staff correct Maya Patel's email after the merge, then undo it
- **THEN** the corrected email stays; only what the merge changed goes back

#### Scenario: a till that was offline
- **WHEN** a till sends a sale, or the customer itself, for Maya P. after the merge, before or after her record is removed
- **THEN** the sale is Maya Patel's, and Maya P. isn't made again

#### Scenario: both have online accounts
- **WHEN** both records have an online account
- **THEN** Merge is refused, saying so, and nothing moves
