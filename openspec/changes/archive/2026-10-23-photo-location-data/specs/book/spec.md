## ADDED Requirements

### Requirement: A booking request's photos are saved without where they were taken

Before a customer's booking photos are saved, the server SHALL remove their hidden details: location, time taken, camera and phone details, and embedded text. It SHALL keep which way up the photo goes and its colour profile, and SHALL NOT change the picture itself.

#### Scenario: A photo taken at home

- **WHEN** Maya adds a photo of her Trek Domane AL 3 taken on her phone at home to her booking request
- **THEN** the saved photo carries no location, no time taken and no phone details

#### Scenario: A phone photo stays the right way up

- **WHEN** the photo was taken with the phone held upright
- **THEN** the saved photo still shows upright

#### Scenario: The picture is unchanged

- **WHEN** a photo has its hidden details removed
- **THEN** the picture itself is exactly the same as the one Maya sent
