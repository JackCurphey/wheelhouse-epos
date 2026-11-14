## MODIFIED Requirements

### Requirement: An email message can carry attachments
An email message SHALL be able to carry one or more attached files, each with its file name, its type and its contents. They SHALL be kept with the message while it waits and handed to the email sender when the message goes, after its minute's Undo like any other. Once the message has left the queue (sent, failed, stuck or undone) its files SHALL be cleared within a round of the sender, and the message itself SHALL stay. A text message SHALL NOT carry an attachment. Sending stays pretend: the pretend sender is given the files and nothing leaves the server (Jack, 20 Oct).

#### Scenario: The attachment goes with the email
- **WHEN** an email message with an attached PDF comes due
- **THEN** the email sender is given the message with the PDF's file name, type and contents, and the outbox records it as pretend

#### Scenario: A text carries no attachment
- **WHEN** a message that would carry an attachment goes to a customer who gets texts
- **THEN** the text is queued with no attachment

#### Scenario: Undo stops the attachment too
- **WHEN** staff undo the message within its minute
- **THEN** neither the message nor its attachment is sent

#### Scenario: The files go with the message
- **WHEN** a customer's messages are removed (their details deleted on request)
- **THEN** the files attached to those messages are removed with them

#### Scenario: Files are cleared once the message has gone
- **WHEN** the sender sends an email message with an attached PDF, or the send fails
- **THEN** the PDF is cleared in that round, and the message stays in the outbox with its status

#### Scenario: An undone message's files are cleared
- **WHEN** staff undo a message carrying a file
- **THEN** its file is cleared by the sender's next round, while another message still in its minute keeps its own
