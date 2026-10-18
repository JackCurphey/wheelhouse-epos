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

### Requirement: The old job form refuses a save on a job changed elsewhere
The old job form, opened from an order, SHALL refuse a save or "Mark complete" on a job someone else changed after it opened, say "This job changed while you were looking at it." and close (kept from the retired review pop-up requirement, which also said this).

#### Scenario: Marking complete
- **WHEN** staff press "Mark complete" on a job someone else saved after the form opened
- **THEN** it says "This job changed while you were looking at it." and the form closes

#### Scenario: Saving
- **WHEN** staff save a job someone else saved after the form opened
- **THEN** it says "This job changed while you were looking at it." and the form closes

## REMOVED Requirements

### Requirement: The old app's Workshop diary shows what is waiting
**Reason**: The old diary is retired (Jack, 18 Oct); the new diary's "Waiting for you" panel does this.
**Migration**: Use the new diary at `/workshop/diary`.

### Requirement: The old app answers what is waiting in a review pop-up
**Reason**: The old diary is retired (Jack, 18 Oct); the new diary's request pop-ups do this.
**Migration**: Use the new diary at `/workshop/diary`.
