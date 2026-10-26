## ADDED Requirements

### Requirement: A shop with many single jobs can search them

The service list SHALL show a search box above the single jobs when the shop has more than 8 of them, labelled "Search the individual services", with the placeholder "Search [n] individual services — like “brakes” or “puncture”". Typing SHALL narrow the single jobs to those whose name has every word typed, ignoring case, and SHALL leave the full services and the ticks as they are.

#### Scenario: 8 or fewer single jobs
- **WHEN** a shop has 8 single jobs
- **THEN** the list has no search box

#### Scenario: searching for brakes
- **WHEN** a shop has 12 single jobs and the customer types "brake"
- **THEN** only the single jobs with "brake" in their name show, under their categories; a category with none left is hidden; every full service still shows

#### Scenario: a ticked job the search hides
- **WHEN** the customer has ticked "Wheel true" and types "brake"
- **THEN** "Wheel true" stays ticked and in the running summary

#### Scenario: nothing matches
- **WHEN** the customer types "zzz"
- **THEN** "No single jobs match “zzz”." shows, and the full services and "Not sure what you need?" still show

### Requirement: Booking that can't load says online booking is unavailable

When the shop's services fail to load for any reason but a shop that doesn't exist, every booking screen SHALL show the heading "Online booking is unavailable just now" and "Please try again in a little while, or call the shop to book.", with "Try again". A shop that doesn't exist SHALL still say "We can't find this shop".

#### Scenario: the server is down
- **WHEN** the services request fails with a server error
- **THEN** the page reads "Online booking is unavailable just now" with "Try again", and pressing it once the server is back shows the booking step
