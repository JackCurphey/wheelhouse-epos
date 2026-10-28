# Spec Delta

## ADDED Requirements

### Requirement: A first sign-in opens "Your till PIN" by itself
Someone on the team with no till PIN SHALL get "Your till PIN" by itself the first time they open Wheelhouse, over the page they land on: "Welcome to [shop], [first name]…", "Keep this PIN", "Give me a different one" and "Skip for now", with no ✕ (UX walk-through 4 H1; `pin-first`). Keeping or skipping SHALL leave them on that page and SHALL not ask again. The Owner's own sign-in SHALL not be asked.

#### Scenario: Jo's first sign-in
- **WHEN** Jo Taylor, just added to the team, signs in for the first time
- **THEN** "Your till PIN" opens with a PIN Wheelhouse picked, and Skip for now

#### Scenario: Skipped
- **WHEN** Jo pressed Skip for now and opens Wheelhouse again
- **THEN** it doesn't open, and Your settings still offers Get your PIN

### Requirement: After a PIN is cleared, the next sign-in gives a new one the same way
When the Owner clears someone's PIN, the next time that person opens Wheelhouse "Your till PIN" SHALL open by itself saying "Your old PIN was cleared, so here’s a new one…", with Skip for now (`pin-cleared`; the clear-PIN note in `set-staff-clear-pin`).

#### Scenario: Jo's PIN was cleared
- **WHEN** the Owner clears Jo Taylor's forgotten PIN and Jo opens Wheelhouse
- **THEN** "Your till PIN" opens with "Your old PIN was cleared, so here’s a new one"
