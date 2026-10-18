## ADDED Requirements

### Requirement: A job's length changes by its bottom edge
Staff SHALL be able to make a timed job longer or shorter by dragging its bottom edge, in 15-minute steps, no shorter than 15 minutes and ending no later than closing time (Jack, 18 Oct, `docs/decisions/2026-10-18-old-diary-features.md` answer 2). The new times and length SHALL show while it changes, and letting go SHALL save the new end time with the version the diary saw.

#### Scenario: Dragging with a mouse
- **WHEN** staff drag the bottom edge of a 10:00–11:00 Brake service down two half-hour rows
- **THEN** it reads "10:00–12:00 · 2 hours" while dragging, and letting go saves the end time 12:00

#### Scenario: The limits
- **WHEN** staff shorten a job below 15 minutes or stretch it past closing time
- **THEN** it stops at 15 minutes, or at closing time

### Requirement: The edge follows the pointer fairly
With a mouse the edge SHALL work on any job shown on its own; a job in a stack uses Change length. The end SHALL follow the edge wherever on it the press was, a press that moves less than 4 pixels SHALL change nothing, and a job SHALL stop at its own day's closing time even when the grid runs later for another day.

#### Scenario: Grabbed at the top of the edge
- **WHEN** staff grab the top of a 14:00–15:00 job's edge and drag it down two half-hour rows
- **THEN** it reads "14:00–16:00 · 2 hours"

#### Scenario: A shorter day
- **WHEN** Tuesday closes at 16:00, other days at 18:00, and staff lengthen a Tuesday 10:00 job as far as it goes
- **THEN** it stops at 16:00

### Requirement: Change length in the job's menu, for touch and the keyboard
On a touch screen the grip SHALL show only after "Change length" in the job's menu (opened by holding the job). It SHALL be at least 44 pixels tall, and a tap elsewhere SHALL leave the length as it was. From the keyboard, "Change length", then up, down, Enter and Escape, SHALL do the same. A booking request or a cancelled booking SHALL NOT offer it.

#### Scenario: A tablet
- **WHEN** staff on a tablet hold a job and choose "Change length"
- **THEN** a grip at least 44 pixels tall shows on its bottom edge; before that, none shows

#### Scenario: The keyboard
- **WHEN** staff choose "Change length" for the 10:00–11:00 Trek Domane, press down twice and Enter
- **THEN** its end time is saved as 11:30 and "Trek Domane now 10:00–11:30." is read out

#### Scenario: A booking request
- **WHEN** staff open a booking request's menu
- **THEN** it has no "Change length"
