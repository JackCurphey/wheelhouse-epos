## ADDED Requirements

### Requirement: The booking page shows the conversation with the shop
From the bike being in the shop until the page closes after collection, the customer's booking page SHALL show "Notes with the shop": the notes so far, a box to add a note (then to reply), and that the shop will reply there and let them know (ac-job-note).

#### Scenario: Waiting for a reply
- **WHEN** Maya sends "Can you check the back light too?"
- **THEN** her page shows it as hers and "Sent. North Street Cycles will reply here, and we’ll let you know when they do."
