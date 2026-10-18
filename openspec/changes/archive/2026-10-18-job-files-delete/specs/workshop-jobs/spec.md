## MODIFIED Requirements

### Requirement: Staff can delete a job
Staff SHALL be able to delete a job without sending a version, unless money has been paid on its order or the bike is in the shop (Jack, 18 Oct, `docs/decisions/2026-10-18-attachments-and-delete.md`). Then the delete SHALL be refused with the code `settle_first`, saying which of the two applies. Its order SHALL be kept, no longer linked to any job, so nothing already added to it is lost. Its attached files SHALL be removed with it. Deleting a job that does not exist SHALL be refused as not found.

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

### Requirement: Staff can attach files to a job
Staff SHALL be able to attach a file to a job, such as an e-bike's diagnostic report, keeping its name and type. A file SHALL be refused if it is missing, empty or over 15MB.

#### Scenario: Attaching a report
- **WHEN** staff attach "report.pdf" to a job
- **THEN** it is saved with that name and its size

#### Scenario: No file, an empty file, or a huge one
- **WHEN** staff send no file, an empty file, or a file over 15MB
- **THEN** it is refused with "No file data received", "That file is empty" or "That file is too large (max 15MB).", and nothing is saved

## ADDED Requirements

### Requirement: The job page shows and adds a job's files and photos
The job page SHALL show "Files and photos" under Notes: photos as small pictures that open larger, other files by name and size, the customer's booking photos marked "From the customer". "Add file or photo" SHALL upload any file up to 15MB, refusing a larger one before sending, and "Remove" SHALL ask "Remove [file]?" first.

#### Scenario: A photo and a report
- **WHEN** a job has the customer's photo brake.jpg and a 20 KB report.pdf
- **THEN** the photo shows as a picture marked "From the customer", and the report as "report.pdf · 20 KB"

#### Scenario: Too large
- **WHEN** staff choose a file over 15MB
- **THEN** it says "That file is too large (max 15MB)." and nothing is sent

### Requirement: The job page deletes a job, or says to settle up first
"Delete job" SHALL sit small at the left of the job page's bottom bar, which SHALL always show. It SHALL ask "Delete [job]?" with "The job, its diary time and its files and photos are removed. This can't be undone.", "Keep the job" and "Delete job". While money has been paid on the order or the bike is in the shop, or the server refuses with `settle_first`, it SHALL instead show "Settle up first" with what is still open.

#### Scenario: Nothing at stake
- **WHEN** staff press Delete job on an expected booking and confirm
- **THEN** the job is deleted and its page closes

#### Scenario: Paid and in the shop
- **WHEN** the job's order is paid and its bike is in the shop
- **THEN** "Settle up first" lists "Paid on its order" and "Bike in the shop", and nothing is deleted
