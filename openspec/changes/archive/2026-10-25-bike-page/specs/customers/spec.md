# Spec Delta

## ADDED Requirements

### Requirement: Each bike has its own page
A bike's page SHALL show the bike's name with "[Customer]’s bike" and New job; its Details (Colour, Frame number, Note) with Edit; who it Belongs to, linking to their page; and "Jobs on this bike", with what's open now first and the rest newest first (`cs-bike`). Each bike on a customer's page SHALL link to it.

#### Scenario: Maya's Trek
- **WHEN** staff open the Trek Domane AL 3 from Maya's page
- **THEN** they see its colour, frame number and note, "Maya Patel’s bike", and every job on it

### Requirement: New job from a bike starts with that bike chosen
New job on a bike's page SHALL open New job with its owner and that bike already chosen.

#### Scenario: Booking the Trek in
- **WHEN** staff press New job on the Trek's page
- **THEN** New job opens with Maya and the Trek chosen
