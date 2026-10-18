## ADDED Requirements

### Requirement: Shared queue shows only the jobs no mechanic has yet
The diary SHALL offer "Shared queue" after the mechanics: a button on desktop and tablet, and the last line of the phone's "whose jobs" list (Jack, 18 Oct, `docs/decisions/2026-10-18-old-diary-features.md` answer 5). Picked, the diary SHALL show only the jobs with no mechanic. The Day view SHALL be one column of them, named "Shared queue", and the choice SHALL be kept in the address as `?who=shared`. With four people buttons the toolbar SHALL stay one row on a screen 1280 pixels wide.

#### Scenario: The week
- **WHEN** staff pick Shared queue in a week where Sam Reed's Specialized Sirrus has no mechanic and Maya Patel's Trek Domane is Alex Morgan's
- **THEN** the Specialized Sirrus shows and the Trek Domane does not

#### Scenario: The Day view
- **WHEN** staff open the Day view with Shared queue picked
- **THEN** there is one column, named "Shared queue", and no column for each mechanic

#### Scenario: A phone
- **WHEN** staff open the phone's "whose jobs" list
- **THEN** its last line is "Shared queue", and picking it shows only the jobs with no mechanic

#### Scenario: A 1280-pixel screen
- **WHEN** the diary is open on a screen 1280 pixels wide
- **THEN** the view switch, the dates, Everyone, each mechanic, Shared queue and New job sit on one row
