## ADDED Requirements

### Requirement: The receipt says who checked the job, when the shop shows it
With "Show who signed off to customers" on, a job's printed receipt SHALL say "Checked by [name]" under the job and bike (`till-receipt-paper-checked`). With it off, the receipt SHALL name no staff.

#### Scenario: Setting on
- **WHEN** WH-1042, signed off by Alex Morgan, is paid and its receipt printed with the setting on
- **THEN** the receipt says "Checked by Alex Morgan" under "WH-1042 · Trek Domane AL 3"
