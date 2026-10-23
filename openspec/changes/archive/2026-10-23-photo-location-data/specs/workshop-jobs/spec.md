## ADDED Requirements

### Requirement: Pictures attached to a job are saved without where they were taken

When staff attach a JPEG, PNG or WebP picture to a job, including a quote line's photo, the server SHALL remove its hidden details before saving it, as for booking photos, keeping which way up it goes and its colour profile. Any other kind of file SHALL be saved as it is.

#### Scenario: A quote line's photo

- **WHEN** Alex adds a photo of the worn rear pads, taken on his phone, to the Shimano brake pads line on WH-1042
- **THEN** the saved photo, and the one Maya sees on her quote, carry no location, time taken or phone details

#### Scenario: A file that isn't a picture

- **WHEN** staff attach a PDF to a job
- **THEN** it is saved exactly as it was sent

#### Scenario: A file that says it's a picture but isn't

- **WHEN** a file is sent claiming to be a photo but its contents aren't a JPEG, PNG or WebP picture
- **THEN** it is saved exactly as it was sent, as today
