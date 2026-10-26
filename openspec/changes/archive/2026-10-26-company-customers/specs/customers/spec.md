## ADDED Requirements

### Requirement: A customer can be a company or club

Add a customer and Edit SHALL ask "This is: A person / A company or club".
For a company or club they SHALL ask for the company or club name and a
contact name, and offer an optional VAT number and an optional "Send
invoices to" email address. The company's name SHALL be the name the shop
sees for that customer everywhere. A "Send invoices to" that isn't an email
address SHALL be refused, and a person SHALL keep no company details.

#### Scenario: adding a company
- **WHEN** staff choose "A company or club" and give [Company name], a contact name, a phone number, VAT number [Company VAT number] and "Send invoices to" [accounts email]
- **THEN** the customer is added as [Company name], a company, with those details

#### Scenario: no contact name
- **WHEN** staff add a company or club without a contact name
- **THEN** it says "Add the contact’s name." and nothing is added

#### Scenario: an invoice address that isn't one
- **WHEN** "Send invoices to" is "accounts@example"
- **THEN** it is refused, saying "That doesn’t look like an email address — check it"

#### Scenario: a company becomes a person
- **WHEN** staff edit a company and choose "A person"
- **THEN** its contact name, VAT number and "Send invoices to" are cleared
