## ADDED Requirements

### Requirement: The time kept free each day is set in Settings
Settings › Workshop › Online booking SHALL hold "Time kept free each day" in hours, from 0 to 8 in half hours, saved when the box is left (`bk-settings-reserve`; Jack, 4 Sep and 19 Oct). Online booking SHALL treat a day as full once less than this is left.

#### Scenario: Three hours for a busy day
- **WHEN** the owner sets Time kept free each day to 3 and moves on
- **THEN** it saves as 180 minutes, and online booking treats a day with less than 3 hours free as full

### Requirement: The old app's Edit workshop screen is gone
The old app SHALL NOT have its own Edit shop › Workshop screen or menu item; Edit shop SHALL open on Front desk.

#### Scenario: The old menu item
- **WHEN** someone opens Edit shop in the old app, or an old link to its Workshop page
- **THEN** Front desk opens, and there's no Workshop item
