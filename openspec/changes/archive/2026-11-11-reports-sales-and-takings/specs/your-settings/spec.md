# Spec Delta

## ADDED Requirements

### Requirement: Show graphs in reports
Your settings › Accessibility SHALL have "Show graphs in reports", for people who can see reports only (the Owner, until roles exist). It SHALL be on to start; turning it off SHALL hide the graph on every report for that person only, leaving the figures and tables.

#### Scenario: Jack hides the graphs
- **WHEN** Jack Lewis turns off "Show graphs in reports"
- **THEN** his reports show no graphs, and it is saved on his login only

#### Scenario: not shown to someone who can't see reports
- **WHEN** Jo Taylor, Staff, opens Your settings
- **THEN** "Show graphs in reports" is not there
