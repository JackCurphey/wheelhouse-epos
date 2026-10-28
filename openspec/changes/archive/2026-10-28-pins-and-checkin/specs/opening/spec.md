# Spec Delta

## MODIFIED Requirements

### Requirement: The first person in who takes payments checks the float
When the shop has a float set and nobody has checked it today, the first person to check in at the till with their PIN that day who takes payments (the Owner, or a team member marked as a cashier) SHALL be asked "Hello, [first name]" and shown "The drawer should have [£ float]", "The shop's float", with "Count it" and "Looks right" as the only ways out: no ✕ (opening the shop decision 2; audit M1; `op-float-check`; Jack's answer 3 of 27 Oct: it moves to the check-in when PIN check-in lands). The check SHALL be recorded under the person checked in.

#### Scenario: First in
- **WHEN** Jo Taylor, a cashier, checks in at the till first today and the shop's float is set
- **THEN** she sees "Hello, Jo" and "The drawer should have [£ float]", with Count it and Looks right

#### Scenario: Not checked in
- **WHEN** nobody has checked in on the till
- **THEN** the till shows Enter your PIN, and the float check waits for the check-in
