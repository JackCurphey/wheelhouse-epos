## ADDED Requirements

### Requirement: Messages are pretend until Jack says otherwise
Every automatic message SHALL be recorded in the outbox as pretend and SHALL NOT be sent to a real phone or email address until Jack switches real sending on for that channel (Jack, 20 Oct).

#### Scenario: Bike ready
- **WHEN** a job is marked finished
- **THEN** "Bike ready" is filled in for the customer and recorded in the outbox as pretend, after a minute's Undo, and nothing is sent

### Requirement: A shop can reword or switch off its messages
Each automatic message SHALL have Wheelhouse's wording, which the shop can reword with tap-ins, switch off, or go back to (owner setup 14).

#### Scenario: Switched off
- **WHEN** the shop switches Bike ready off
- **THEN** finishing a job queues no Bike ready message

#### Scenario: Only the Owner changes a message
- **WHEN** a staff member who isn't the Owner changes a message
- **THEN** it is refused, as other Settings are until roles are built

#### Scenario: Going back to Wheelhouse's wording
- **WHEN** the Owner clears a message's wording, or chooses Go back to Wheelhouse's wording
- **THEN** the message reads Wheelhouse's wording again

#### Scenario: Preview
- **WHEN** someone previews a message, as saved or as they type it
- **THEN** they see it filled in with the drawings' example (Maya, Trek Domane AL 3, WH-1042) and the shop's own name, as a text and as an email with its subject

### Requirement: Staff can undo a message for a minute
A message staff trigger SHALL wait a minute before it goes, and Undo in that minute SHALL stop it (drop-off and quote decision 5; UX walk-through H2).

#### Scenario: Undo
- **WHEN** staff send a quote and press Undo within the minute
- **THEN** Quote to approve isn't sent
