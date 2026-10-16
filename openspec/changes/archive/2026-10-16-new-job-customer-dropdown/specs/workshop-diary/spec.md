## ADDED Requirements

### Requirement: New job's customer search drops down without resizing the form
On New job, the customers matching what is typed, or "No customer matches “[text]”.", SHALL drop down over the form just under the search box, so the New job pop-up keeps its size while staff type (Jack, 16 Oct). The list SHALL close when a customer is chosen, on Escape while it shows, or when the focus leaves the search, and SHALL open again when staff type. Choosing a result SHALL work in every browser, Safari and iPad included. A screen reader SHALL hear how many customers were found, or that none match.

#### Scenario: A name that matches no one
- **WHEN** staff type "zz" into "Find customer by name, phone or email"
- **THEN** "No customer matches “zz”." shows under the box and the New job pop-up is the same height as before

#### Scenario: Escape closes the list
- **WHEN** the list is showing and staff press Escape in the search box
- **THEN** the list closes, "zz" stays in the box, and the New job form stays open
