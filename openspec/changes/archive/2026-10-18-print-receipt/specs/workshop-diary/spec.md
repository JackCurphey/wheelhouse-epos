## ADDED Requirements

### Requirement: The diary menu prints a paid job's receipt
The job menu SHALL offer "Print receipt", which prints the receipt of the sale that paid the job's order (Jack, 18 Oct, `docs/decisions/2026-10-18-print-receipt.md`). Until the order is paid it SHALL be greyed with "Not paid yet" (`diary-menu-job`), or "Order cancelled" once the order is cancelled.

#### Scenario: A paid job
- **WHEN** staff open WH-1042's menu after its order is paid and choose Print receipt
- **THEN** its receipt prints

#### Scenario: Not paid yet
- **WHEN** a job's order is still open, or it is a booking request
- **THEN** Print receipt is greyed with "Not paid yet"
