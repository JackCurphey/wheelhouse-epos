# Spec Delta

## ADDED Requirements

### Requirement: The header search finds bikes
Typing at least two characters SHALL also find up to five of the shop's bikes, by make and model or frame number, listed in a Bikes group after Customers. Each one SHALL link to the bike's own page, showing its owner, colour and frame number under it. Removed bikes, and bikes of removed customers, SHALL not be found, and another shop's bikes never.

#### Scenario: a frame number
- **WHEN** Jo types the Trek's frame number
- **THEN** the Trek Domane AL 3 is listed under Bikes, with "Maya Patel" under it, and opens its page

#### Scenario: make and model
- **WHEN** Jo types "trek domane"
- **THEN** Maya's Trek is listed under Bikes
