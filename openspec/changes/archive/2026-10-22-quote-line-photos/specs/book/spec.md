## ADDED Requirements

### Requirement: The customer sees a quote line's photo and can enlarge it
A quote line with a photo SHALL show a small picture beside its reason on the customer's quote, with "Tap to enlarge"; tapping it SHALL open the photo larger, titled with the line and its reason (Jack, 1 Oct). The photo SHALL be served only through the booking's link, and only for a line of its current quote.

#### Scenario: Enlarging the pads photo
- **WHEN** Maya taps the photo beside Shimano brake pads
- **THEN** a pop-up titled "Shimano brake pads" shows the reason and the photo larger, with Close

#### Scenario: A photo not on the current quote
- **WHEN** a link asks for the photo of a line on an older revision, or of another booking's line
- **THEN** nothing is served (not found)
