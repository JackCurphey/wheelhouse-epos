## MODIFIED Requirements

### Requirement: Staff can delete a job
Staff SHALL be able to delete a job without sending a version, unless money has been paid on its order or the bike is in the shop (Jack, 18 Oct, `docs/decisions/2026-10-18-attachments-and-delete.md`). Then the delete SHALL be refused with the code `settle_first`, saying which of the two applies. Its order SHALL be kept, no longer linked to any job, so nothing already added to it is lost. Its attached files SHALL be removed with it. Any message to the customer about the job still waiting to go SHALL be stopped with it, as Undo stops one, so nothing is sent about a job that no longer exists; a message already on its way or sent SHALL be left as it is. A delete and a quote answer for the same job at the same moment SHALL each go through or be refused in plain terms, one after the other, never failing with a server error. Deleting a job that does not exist SHALL be refused as not found.

#### Scenario: Deleting a job keeps its order
- **WHEN** staff delete a job that has an order
- **THEN** the job can no longer be read, and the order still exists with no job linked

#### Scenario: Deleting a job that is not there
- **WHEN** staff delete a job that does not exist
- **THEN** it is refused as not found

#### Scenario: The bike is in the shop
- **WHEN** staff delete a job whose bike has been booked in
- **THEN** it is refused with `settle_first`, the bike in the shop, and the job remains

#### Scenario: The order is paid
- **WHEN** staff delete a job whose order has been paid
- **THEN** it is refused with `settle_first` and money paid

#### Scenario: A Bike ready still in its minute
- **WHEN** staff delete a job whose "Bike ready" message is still waiting its minute
- **THEN** the message is marked undone and is never sent

#### Scenario: A refused delete stops nothing
- **WHEN** a delete is refused with `settle_first`
- **THEN** the job's waiting messages are still waiting

#### Scenario: A quote is answered as the job is deleted
- **WHEN** a quote on a job is being answered and staff delete the job at the same moment
- **THEN** neither gets a server error: the answer goes in first and the job is then deleted with its order kept, or the job is deleted first and the answer is refused as not found
