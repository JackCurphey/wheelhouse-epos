## ADDED Requirements

### Requirement: A quote with no answer after its reminder shows "No answer yet"
When a job's quote is still waiting for the customer after its one reminder went, the diary SHALL call the job "No answer yet" where it would say "Quoting", and the job's page SHALL show "No answer to the quote yet" with when the quote and the reminder were sent and the customer's phone number, above Record their answer (Jack, 1 Oct, drop-off and quote decision 4; dq-today-no-answer).

#### Scenario: The reminder went and nothing came back
- **WHEN** Maya's quote was sent, its reminder went, and she hasn't answered
- **THEN** the diary's WH-1042 reads "No answer yet", and its page says "No answer to the quote yet", "Sent [time] · reminder sent [time] · 07700 900 142" with Record their answer

#### Scenario: Before the reminder
- **WHEN** the quote was sent and its reminder hasn't gone yet
- **THEN** the job reads "Quoting", with no "No answer yet" line

#### Scenario: Answered
- **WHEN** Maya answers after the reminder
- **THEN** "No answer yet" goes
