# Spec Delta

## ADDED Requirements

### Requirement: Reminders are set up and written at a busy moment
Setting up a service reminder or a review request when a bike is collected, writing them when they go, and finding the shop's own automatic messages SHALL read the shop's details on the shop's own database connection, never a second one, so a busy moment can't stall them.

#### Scenario: 12 bikes collected at once
- **WHEN** 12 bikes are marked collected at the same moment, each for a customer who said yes to reminders and review requests
- **THEN** every collection is answered well within the 5-second wait for a connection, and each job has its service reminder and its review request

#### Scenario: a message is written while every other connection is busy
- **WHEN** a service reminder or a review request comes due, or a shop's own message after a sale is found, while every other database connection is in use
- **THEN** it is written at once, with the shop's name, not after a 5-second wait
