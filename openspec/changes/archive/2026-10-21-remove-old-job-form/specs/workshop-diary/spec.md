## MODIFIED Requirements

### Requirement: The old app's Workshop tab opens the new diary
The old app's Workshop tab, and any old `#workshop` address, SHALL open the new diary at `/workshop/diary` (Jack, 18 Oct, `docs/decisions/2026-10-18-retire-old-diary.md`). The old app SHALL NOT have its own workshop job form; an order's workshop job opens in the new diary.

#### Scenario: An old bookmark
- **WHEN** staff open the old app at `#workshop`
- **THEN** the new diary opens at `/workshop/diary`

#### Scenario: The tab
- **WHEN** staff click Workshop in the old app's top bar
- **THEN** the new diary opens

#### Scenario: A job opened from its order
- **WHEN** staff open an order's workshop job with "View / edit workshop job"
- **THEN** the new diary opens on the job's day with the job's page open, and no old-app job form opens

## REMOVED Requirements

### Requirement: The old job form refuses a save on a job changed elsewhere
**Reason**: The old job form is gone; nothing opened it after #342.
**Migration**: None for staff: an order's job opens on the new job page. The server's own refusal of an out-of-date old-app save stays in the `workshop-jobs` spec.
