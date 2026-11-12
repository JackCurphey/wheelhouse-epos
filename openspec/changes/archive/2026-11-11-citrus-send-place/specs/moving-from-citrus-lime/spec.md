## ADDED Requirements

### Requirement: Files are taken one at a time, the next as soon as the last is answered
A shop SHALL send one Citrus Lime file at a time. A second send while one is still being taken SHALL be told "Wheelhouse is still taking in another of your files. Try again in a moment." A send made once the last one has been answered, whatever the answer, SHALL NOT be turned away as busy.

#### Scenario: Files sent one after another
- **WHEN** the Owner drops several files and the page sends each as soon as the last was taken
- **THEN** each is taken, up to ten waiting to be read, with none refused as busy

#### Scenario: Two at once
- **WHEN** a send is still coming in and the shop sends another
- **THEN** the second is told Wheelhouse is still taking in another of its files, to try again in a moment
