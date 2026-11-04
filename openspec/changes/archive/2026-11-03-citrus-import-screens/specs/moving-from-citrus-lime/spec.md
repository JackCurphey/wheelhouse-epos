## ADDED Requirements

### Requirement: The owner brings their data across from one page
Office › Moving from Citrus Lime SHALL show the three stages, the files to download and one place to drop them, for the Owner only. Dropping files SHALL start bringing them across, with no Import button.

#### Scenario: Nothing sent yet
- **WHEN** the Owner opens the page with nothing sent
- **THEN** it shows "Bring your data from Citrus Lime", each kind "Not added yet", and "Drop all the files here"

#### Scenario: Anyone else
- **WHEN** someone other than the Owner opens the page
- **THEN** they're told it's for the shop's owner, and it isn't in their sidebar

### Requirement: Progress shows and the owner can leave
While files come across the page SHALL show each kind's state, announced to screen readers, and say the owner can leave. A file Wheelhouse can't read SHALL say so and offer another.

#### Scenario: Coming across
- **WHEN** a price list is part-way across
- **THEN** Products shows its file name and how many of how many, with "You can leave this page"

#### Scenario: Can't read it
- **WHEN** a file is refused as unreadable
- **THEN** its row says "Wheelhouse couldn’t read this file" and "Couldn’t read it", with Choose another file

#### Scenario: No answer
- **WHEN** a send gets no answer
- **THEN** it's sent once more with the same key, so it can't count twice

### Requirement: A plain summary of what came across
When everything sent is in, the page SHALL say how many came across for each kind, All in or how many need a look.

#### Scenario: Some need a look
- **WHEN** a price list and barcode file finished with rows needing a look
- **THEN** Products says how many came across and how many, in all, need a look
