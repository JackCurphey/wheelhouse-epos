## ADDED Requirements

### Requirement: Cycle to Work messages can each be switched off
The message list SHALL include the four Cycle to Work messages Jack's decision names, "Your bike is put aside", "Certificate received", "Ready to collect" and "Your hold ends on [date]", each with the drawn wording and the private "See your Cycle to Work bike: [link]", and each switchable.

#### Scenario: The ready message
- **WHEN** an order moves to "Ready to collect" and the message is on
- **THEN** the customer is sent "Hi [first name], your Cycle to Work certificate has reached us and [Bike] · [Size] is ready to collect. Quote [quote number]. See your Cycle to Work bike: [link]"

#### Scenario: A switched-off message
- **WHEN** "Certificate received" is switched off
- **THEN** adding the certificate sends nothing
