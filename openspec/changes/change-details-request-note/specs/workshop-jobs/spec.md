## ADDED Requirements

### Requirement: Change details notes a waiting change request
When a customer's change request is waiting, Change details SHALL show "Change requested" at its top with "[customer] asked to move this to [day], [time]. Setting that time here accepts it; any other change leaves the request waiting in Waiting for you.", adding "with [mechanic]" when the request moves the job to another mechanic (Jack, 18 Oct). It SHALL be an addition only: the request stays in Waiting for you, answered there.

#### Scenario: A request waiting
- **WHEN** Oliver Chen has asked to move his booking to Wed 7 Oct, 14:00, and staff open Change details
- **THEN** it reads "Oliver Chen asked to move this to Wed 7 Oct, 14:00. Setting that time here accepts it; any other change leaves the request waiting in Waiting for you."

#### Scenario: To another mechanic
- **WHEN** the request also moves the booking from Alex Morgan to Jo Taylor
- **THEN** it reads "… to Wed 7 Oct, 14:00 with Jo Taylor. …"

#### Scenario: No request
- **WHEN** no change request is waiting
- **THEN** Change details shows no note
