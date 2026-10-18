## ADDED Requirements

### Requirement: A job's length changes by its bottom edge
Staff SHALL be able to make a timed job longer or shorter by dragging its bottom edge (Jack, 18 Oct, `docs/decisions/2026-10-18-old-diary-features.md` answer 2), in 15-minute steps. It SHALL be no shorter than 15 minutes and end no later than closing time. While it changes, the new times and length SHALL show ("11:30–13:30 · 2 hours"). Letting go SHALL save the new end time with the version the diary saw. With a mouse the edge SHALL always work. On a touch screen the grip SHALL show only after "Change length" in the job's menu (opened by holding the job), SHALL be at least 44 pixels tall, and a tap elsewhere SHALL leave the length as it was. From the keyboard, "Change length" in the menu, then up and down, Enter and Escape SHALL do the same. A booking request or a cancelled booking SHALL NOT offer it.

#### Scenario: Dragging with a mouse
- **WHEN** staff drag the bottom edge of a 10:00–11:00 Brake service down two half-hour rows
- **THEN** it reads "10:00–12:00 · 2 hours" while dragging, and letting go saves the end time 12:00

#### Scenario: A tablet
- **WHEN** staff on a tablet hold a job and choose "Change length"
- **THEN** a grip at least 44 pixels tall shows on its bottom edge; before that, none shows

#### Scenario: The keyboard
- **WHEN** staff choose "Change length" for the 10:00–11:00 Trek Domane, press down twice and Enter
- **THEN** its end time is saved as 11:30 and "Trek Domane now 10:00–11:30." is read out

#### Scenario: The limits
- **WHEN** staff shorten a job below 15 minutes or stretch it past closing time
- **THEN** it stops at 15 minutes, or at closing time

#### Scenario: A booking request
- **WHEN** staff open a booking request's menu
- **THEN** it has no "Change length"
