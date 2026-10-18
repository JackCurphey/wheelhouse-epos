## ADDED Requirements

### Requirement: The old app's Workshop tab opens the new diary
The old app's Workshop tab, and any old `#workshop` address, SHALL open the new diary at `/workshop/diary` (Jack, 18 Oct, `docs/decisions/2026-10-18-retire-old-diary.md`). The old job form, still opened from an order, SHALL list the shop's mechanics without the diary having been opened first.

#### Scenario: An old bookmark
- **WHEN** staff open the old app at `#workshop`
- **THEN** the new diary opens at `/workshop/diary`

#### Scenario: The tab
- **WHEN** staff click Workshop in the old app's top bar
- **THEN** the new diary opens

#### Scenario: A job opened from its order
- **WHEN** staff open an order's workshop job with "View / edit workshop job"
- **THEN** the job form's mechanic list has the shop's mechanics

## REMOVED Requirements

### Requirement: The old app's Workshop diary shows what is waiting
**Reason**: The old diary is retired (Jack, 18 Oct); the new diary's "Waiting for you" panel does this.
**Migration**: Use the new diary at `/workshop/diary`.

### Requirement: The old app answers what is waiting in a review pop-up
**Reason**: The old diary is retired (Jack, 18 Oct); the new diary's request pop-ups do this.
**Migration**: Use the new diary at `/workshop/diary`.
