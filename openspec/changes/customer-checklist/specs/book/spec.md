## ADDED Requirements

### Requirement: The finished job's checklist shows on the booking page
Once the work is finished, the ready and collected booking pages SHALL show the job's checklist, if it has one, after "What we did": each check done, reading "All working well" or "What the mechanic found:" with its note, then "[n] of [n] checks done." and the checks not done by name (cp-summary; Workshop day 21; audit M1, Jack 30 Sep). It SHALL NOT show while the work is under way.

#### Scenario: Eight of ten done, one note
- **WHEN** the mechanic ticked eight checks, noting the brakes, and finished the work
- **THEN** the page lists the eight, the brakes with what the mechanic found, and reads "8 of 10 checks done. Not done: Cables & housing, Bolts torqued."
