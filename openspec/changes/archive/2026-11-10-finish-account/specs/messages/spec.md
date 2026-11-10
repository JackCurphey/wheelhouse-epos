# Spec Delta

## ADDED Requirements

### Requirement: A service reminder carries its own booking link
Each service reminder SHALL carry a link of its own that opens the booking for that customer's bike and service (see the `book` capability), made when the reminder is set up and kept until the customer's record is deleted; a merge SHALL move it with the customer. While messages are pretend the link SHALL read "[link]", as every link does.

#### Scenario: a reminder goes
- **WHEN** Maya's Standard service reminder for her Trek goes
- **THEN** its link opens Book a repair with her Trek and Standard service chosen

#### Scenario: pretend sending
- **WHEN** messages are pretend
- **THEN** the reminder's booking link reads "[link]"
