# Spec Delta

## ADDED Requirements

### Requirement: Staff links never wait for a second connection
Issuing a job's link (Bike ready, booking messages, a sent quote, the private link) and a photo code for Use my phone SHALL read the shop's web address through the request's own connection.

#### Scenario: a burst of private links
- **WHEN** a shop's staff ask for 12 jobs' private links at the same moment
- **THEN** every one is answered with a link to that shop's own pages, well within the 5-second wait
