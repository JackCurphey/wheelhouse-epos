## MODIFIED Requirements

### Requirement: A move the shop's rules refuse is put back, and says why
A move SHALL be checked against the shop's rules for a job's day and time (see `workshop-jobs`). When it is refused, the job SHALL stay where it was and the diary SHALL show "Couldn't move [bike]: " and why: the server's reason when it is already plain English, "The work is already finished. Reopen the job to change it." for finished work, "This job no longer exists." for a deleted job, "That mechanic is no longer working here. Choose another." for a mechanic who has left (Jack, 15 Oct), or "This job changed while you were looking at it." and reload when someone else changed the job first. A booking request, a customer's cancellation and a job with no time SHALL NOT be movable on the diary.

#### Scenario: A clash with another job
- **WHEN** staff drop a job over another of the same mechanic's jobs
- **THEN** the diary shows "Couldn't move Trek Domane AL 3: That mechanic is already booked over part of that window - please choose another time."

#### Scenario: Someone else got there first
- **WHEN** another member of staff changed the job after this diary loaded
- **THEN** the diary shows "Couldn't move Trek Domane AL 3: This job changed while you were looking at it."

#### Scenario: A booking request
- **WHEN** the Specialized Sirrus booking is still a request
- **THEN** it cannot be picked up or dragged

#### Scenario: Finished work
- **WHEN** staff drop a job whose work is finished
- **THEN** the diary shows "Couldn't move Trek Domane AL 3: The work is already finished. Reopen the job to change it."
